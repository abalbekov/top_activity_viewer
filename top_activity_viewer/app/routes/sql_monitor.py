import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

from .connections import get_db_connection, conn_dict
from app import app


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
   
    
# for testing:
if __name__ == '__main__':
    #(host='0.0.0.0') below is to bind it to all interfaces
    app.run(host='0.0.0.0', threaded=True)
    # app.run(debug=False, threaded=True)
    # Alternatively
    #app.run(processes=3)
