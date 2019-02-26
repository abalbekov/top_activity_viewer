
import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

from app import app
from .connections import get_db_connection, conn_dict

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
    #cursor.execute("""select count(1) from gv$instance""")
    #rec = cursor.fetchone()
    #v_rac_instances = rec[0]
    #print ('v_rac_instances:', v_rac_instances)

    str3_instance = "" if 'all' in str(v_selected_instance) else "and instance_number = "+str(v_selected_instance)

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
		{str3}
        and sample_time between 
             cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
               + ( 1 / 24 / 60 / 60 )/1000 * :1 
             and 
             cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
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
    order by sample_time_browser_tz_5min desc""".format(str1=db_os_tz, str2=browzer_tz_name, str3=str3_instance)

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

