import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

app = Flask(__name__, static_url_path='/static')


# function to return connection from global object if connection exists;
# otherwise, open connection and save it in the g object for later use
conn_dict = {}
def get_db_connection(conn_name):
    if conn_name not in conn_dict:
        # save connection and save os db timezone
        # use threaded cx_Oracle to let multiple browsers call
        conn = cx_Oracle.connect(os.environ[conn_name], threaded=True)
        cursor = conn.cursor()
        cursor.execute("""SELECT TO_CHAR(SYSTIMESTAMP, 'tzr') FROM dual""")
        db_os_tz = cursor.fetchone()[0]
        conn_dict[conn_name] = {}
        conn_dict[conn_name]["conn"] = conn
        conn_dict[conn_name]["db_os_tz"] = db_os_tz
    return conn_dict[conn_name]["conn"]

@app.route('/get_credentials')
def get_credentials():
    # extract from env variables those starting with "db"
    return jsonify(
       [ conn_name for conn_name in list(os.environ) if conn_name.lower().startswith("db") ])


#--
# generate DBMS_SQLTUNE report_sql_monitor report
#--
@app.route('/dbms_sqltune_report_sql_monitor', methods = ['POST'])
def dbms_sqltune_report_sql_monitor():
    
    print('dbms_sqltune_report_sql_monitor(): request.form: ', request.form)
    
    v_conn_name     =request.form['conn_name']
    v_sql_id        =request.form['sql_id']
    v_sql_exec_start=request.form['sql_exec_start'] 
    # incoming format: '2017-11-08T11:36:42'
    v_sql_exec_start=datetime.datetime.strptime(v_sql_exec_start, '%Y-%m-%dT%H:%M:%S')
    v_sql_exec_id   =request.form['sql_exec_id']
    
    con = get_db_connection(v_conn_name)
    if not con:
       return []
       
    cursor = con.cursor()
    v_sql_str = """
                SELECT DBMS_SQLTUNE.report_sql_monitor(
                 sql_id => :1
                ,sql_exec_start=>:2
                ,sql_exec_id=>:3
                ,report_level => 'all') from dual
                """

    cursor.execute(v_sql_str, (v_sql_id,v_sql_exec_start,v_sql_exec_id))
    report = cursor.fetchone()
    report = str(report[0])
    print ('report:', report)
    cursor.close()
#    con.close()
    return report



#--
# provide number of RAC instances
#--
@app.route('/rac_instances', methods = ['POST'])
def rac_instances():

    #v_conn_name=request.args.get('conn_name')
    print('rac_instances(): request.form : ', request.form)
    print('rac_instances(): request : ', request)
    
    v_conn_name=request.form.get('conn_name')
    print('rac_instances(): v_conn_name : ', v_conn_name)

    con = get_db_connection(v_conn_name)
    #con = cx_Oracle.connect(os.environ[v_conn_name])
    print ('rac_instances(): ', con.version)
    
    if not con:
       return []
       
    cursor = con.cursor()
    cursor.execute("""select count(1) from gv$instance""")
    inst_cnt = cursor.fetchone()
    print ('inst_cnt:', inst_cnt)
    cursor.close()
    return str(inst_cnt[0])

#--
# provide number of CPU cores
#--
@app.route('/cpu_cores', methods = ['POST'])
def cpu_cores():

    print('cpu_cores(): request.form : ', request.form)
    print('cpu_cores(): request : ', request)
    
    v_conn_name=request.form.get('conn_name')
    print('cpu_cores(): v_conn_name : ', v_conn_name)

    con = get_db_connection(v_conn_name)
    print ('cpu_cores(): ', con.version)
    
    if not con:
       return []
       
    cursor = con.cursor()
    cursor.execute("""select value from v$osstat where stat_name='NUM_CPU_CORES'""")
    cpu_cores = cursor.fetchone()
    print ('cpu_cores:', cpu_cores)
    cursor.close()
    return str(cpu_cores[0])
	

#--
# provide data from SQL_MONITOR
#--  
@app.route('/get_sql_monitor_object', methods = ['POST'])
def get_sql_monitor_object():

    print("get_sql_monitor_object() request.form['conn_name']: ", request.form['conn_name'])
    v_conn_name=request.form['conn_name']
    browzer_tz_name=request.form['browzer_tz_name']
    
    con = get_db_connection(v_conn_name)
    if not con:
       return [] #need to return error here and display the error in ajax error handle ..
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
    
    cursor = con.cursor()
    cursor.arraysize = 500
    
    # Using "select *" to be flexible with different oracle versions 
    # having different columns in gv$sql_monitor.
    # cx_Oracle will get all columns with select "*" and send it to browser in JSON.
    # Browser's javascript will display all received fields as datatables's child row
    v_sql="""select 
                to_char(cast((from_tz(cast(SQL_EXEC_START as timestamp),'{str6}') at time zone '{str5}') as date),'DD-MON-YY HH24:MI:SS') as SQL_EXEC_START_browser_tz
                ,m.* 
            from gv$sql_monitor m 
            where px_qcsid is null
            order by sql_exec_start, elapsed_time""".format(str6=db_os_tz, str5=browzer_tz_name)
    
    print(v_sql)
    cursor.execute(v_sql)
    
    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage
    def generate():
        columns = [i[0] for i in cursor.description]
        row = cursor.fetchone()
        #ret=dict(zip(columns, row)) if (row != None) else None
        #ret=dict(zip_longest(columns, row if (row != None) else []))
        if row == None:
            ret=dict.fromkeys(columns)
        else:
            ret=dict(zip(columns, row))
        
        # json.dumps helper to convert 
        # "json-unfriendly" columns (date, clob, raw) to string 
        def dthandler(obj):
           # convert oracle's DATE to string
           if isinstance(obj, datetime.datetime): 
               return obj.isoformat() 
           # simulate oracle's RAWTOHEX
           elif isinstance(obj, bytes): 
               return obj.hex()
           # simulate oracle's TO_CHAR
           elif isinstance(obj, cx_Oracle.LOB): 
               return str(obj)
           # otherwise original default
           else: 
               return json.JSONEncoder().default(obj)

        ret="[\n"+json.dumps(ret,default=dthandler)+"\n"
        yield ret
        # 50 ms sleep is a workaround for issue with response occasionally 
        # streaming first yield (containing opening bracket)
        # out of order, after couple of first rows
        # which breaks json syntax in browser ajax
        sleep(0.05) 
        for row in cursor:
            if row == None:
                ret=dict.fromkeys(columns)
            else:
                ret=dict(zip(columns, row))

            ret=","+json.dumps(ret,default=dthandler)+"\n"
            yield ret
        yield "]"
        
    return Response(generate(), mimetype='application/json')

#--
# provide detailed chart data sourced from V$ACTIVE_SESSION_HISTORY
#--  
@app.route('/chart_data_ash_detail', methods = ['POST'])
def chart_data_ash_detail():
    post_data_dict=request.get_json()
    print(post_data_dict)
        # this gives {'conn_name': 'ewdb_ste_system', 'selected_instance':'1' ,'metric_names': ['some metric_name','DB Block Changes Per Sec - Derived']}
    v_conn_name=post_data_dict['conn_name']
    v_selected_instance=post_data_dict['selected_instance']
    #metric_list=post_data_dict['metric_names']
    start_date=post_data_dict['date_range'][0]
    end_date=post_data_dict['date_range'][1]
    print("date_range : ", start_date, end_date)
    browser_tz_offset_sec=post_data_dict['browser_tz_offset_sec']
    browzer_tz_name=post_data_dict['browzer_tz_name']
    print("browzer_tz_name : ", browzer_tz_name)
    print("browser_tz_offset_sec :", browser_tz_offset_sec)
    
    con = get_db_connection(v_conn_name)
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
       
    cursor = con.cursor()
    cursor.arraysize = 50
    
    # determine how many instances are there
    cursor.execute("""select count(1) from gv$instance""")
    rec = cursor.fetchone()
    v_rac_instances = rec[0]
    print ('v_rac_instances:', v_rac_instances)

    v_sql="""
            with pivot_data AS (
				   select count(1)/5 as active_sessions
                   ,to_char(
							from_tz(sample_time,'{str1}') at time zone '{str2}'
                               - mod(extract(second from sample_time), 5)/60/60/24 
                            , 'YYYY/MM/DD HH24:MI:SS')
                        as sample_time_browser_tz_5sec
                   ,case when session_state = 'ON CPU' then 'ON CPU'
                    else wait_class end as activity_class
                from v$active_session_history
				where nvl(wait_class,'NONE') <> 'Idle'
                  and sample_time between 
                       cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                         + ( 1 / 24 / 60 / 60 )/1000 * :1 
                       and 
                       cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                         + ( 1 / 24 / 60 / 60 )/1000 * :2 
                group by
                    to_char(
                            --from_tz(sample_time,'{str1}') at time zone '{str2}'
							from_tz(sample_time,'{str1}') at time zone '{str2}'
                               - mod(extract(second from sample_time), 5)/60/60/24 
                            , 'YYYY/MM/DD HH24:MI:SS')
                   ,case when session_state = 'ON CPU' then 'ON CPU'
                    else wait_class end 
                )
            --
            select  sample_time_browser_tz_5sec
                   ,other
                   ,clustr
                   ,queueing
                   ,network
                   ,administrative
                   ,configuration
                   ,commit
                   ,application
                   ,concurrency
                   ,system_io
                   ,user_io
                   ,scheduler
                   ,cpu
            from pivot_data
            pivot
            ( sum(active_sessions)
            for activity_class
                in (
                    'Other'          as other
                   ,'Cluster'        as clustr
                   ,'Queueing'       as queueing
                   ,'Network'        as network
                   ,'Administrative' as administrative
                   ,'Configuration'  as configuration
                   ,'Commit'         as commit
                   ,'Application'    as application
                   ,'Concurrency'    as concurrency
                   ,'System I/O'     as system_io
                   ,'User I/O'       as user_io
                   ,'Scheduler'      as scheduler
                   ,'ON CPU'         as cpu)
            )
            order by sample_time_browser_tz_5sec desc""".format(str1=db_os_tz, str2=browzer_tz_name)

    print(v_sql)
    #cursor.execute(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )

    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage

    # returning Array-formatted stream
    def generate():
        row = cursor.fetchone()
        ret="[\n"+json.dumps(row)+"\n"
        yield ret
        sleep(0.05)         
        for row in cursor:
            ret=","+json.dumps(row)+"\n"
            yield ret
        yield "]"
    return Response(generate(), mimetype='application/json')
    
#--
# provide summary chart data sourced from DBA_HIST_ACTIVE_SESS_HISTORY
#--
@app.route('/chart_data_ash_summary', methods = ['POST'])
def chart_data_ash_summary():
    post_data_dict=request.get_json()
    print(post_data_dict)
        # this gives {'conn_name': 'ewdb_ste_system', 'selected_instance':'1' ,'metric_names': ['some metric_name','DB Block Changes Per Sec - Derived']}
    
    v_conn_name=post_data_dict['conn_name']
    v_selected_instance=post_data_dict['selected_instance']
    browzer_tz_name=post_data_dict['browzer_tz_name']
    start_date=post_data_dict['date_range'][0]
    end_date=post_data_dict['date_range'][1]

    con = get_db_connection(v_conn_name)
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
   
    cursor = con.cursor()
    cursor.arraysize = 50
    
    v_selected_instance=post_data_dict['selected_instance']
    
    # determine how many instances are there
    cursor.execute("""select count(1) from gv$instance""")
    rec = cursor.fetchone()
    v_rac_instances = rec[0]
    print ('v_rac_instances:', v_rac_instances)

    v_sql="""
    with pivot_data AS (
        select 
		    count(1)/30 as active_sessions,
            to_char(
                    trunc( from_tz(sample_time,'{str1}') at time zone '{str2}','MI') 
                    - mod(extract(minute from sample_time), 5)/60/24 
                    , 'YYYY/MM/DD HH24:MI')
                as sample_time_browser_tz_5min, 
            case when session_state = 'ON CPU' then 'ON CPU'
                else wait_class end as activity_class
        from DBA_HIST_ACTIVE_SESS_HISTORY 
		where nvl(wait_class,'NONE') <> 'Idle'
        and sample_time between 
             cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
               + ( 1 / 24 / 60 / 60 )/1000 * :1 
             and 
             cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
               + ( 1 / 24 / 60 / 60 )/1000 * :2 
        group by
            trunc( from_tz(sample_time,'{str1}') at time zone '{str2}','MI') 
                - mod(extract(minute from sample_time), 5)/60/24, 
            case when session_state = 'ON CPU' then 'ON CPU'
            else wait_class end
            )
    --
    select  sample_time_browser_tz_5min, 
            other,
            clustr,
            queueing,
            network,
            administrative,
            configuration,
            commit,
            application,
            concurrency,
            system_io,
            user_io,
            scheduler,
            cpu
    from pivot_data
    pivot
    ( sum(active_sessions)
    for activity_class
        in (
            'Other'          as other,
            'Cluster'        as clustr,
            'Queueing'       as queueing,
            'Network'        as network,
            'Administrative' as administrative,
            'Configuration'  as configuration,
            'Commit'         as commit,
            'Application'    as application,
            'Concurrency'    as concurrency,
            'System I/O'     as system_io,
            'User I/O'       as user_io,
            'Scheduler'      as scheduler,
            'ON CPU'         as cpu)
    )
    order by sample_time_browser_tz_5min desc""".format(str1=db_os_tz, str2=browzer_tz_name)


    print(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )

    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage
    
    # returning Array-formatted stream
    def generate():
        row = cursor.fetchone()
        ret="[\n"+json.dumps(row)+"\n"
        yield ret
        sleep(0.05)         
        for row in cursor:
            ret=","+json.dumps(row)+"\n"
            yield ret
        yield "]"
    return Response(generate(), mimetype='application/json')
    
# for testing:
if __name__ == '__main__':
    #(host='0.0.0.0') below is to bind it to all interfaces
    app.run(host='0.0.0.0', threaded=True)
    # app.run(debug=False, threaded=True)
    # Alternatively
    #app.run(processes=3)
