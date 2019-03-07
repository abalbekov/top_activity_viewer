import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

from app import app
from .connections import get_db_connection, conn_dict

#--
# provide counts of wait classes and events in from GV$ACTIVE_SESSION_HISTORY
#--  
@app.route('/wait_events_ash_detail', methods = ['POST'])
def wait_events_ash_detail():
    print("wait_events_ash_detail(): request.form:", request.form)
    post_data_dict=request.get_json()
    v_conn_name=request.form.get('conn_name')
    v_selected_instance=request.form.get('selected_instance')
    start_date=request.form.get('start_date')
    end_date=request.form.get('end_date')
    #print("date_range : ", start_date, end_date)
    
    con = get_db_connection(v_conn_name)
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
       
    cursor = con.cursor()
        
    str3_instance = "" if 'all' in str(v_selected_instance) else "and inst_id = "+str(v_selected_instance)

    v_sql="""
	        with counts as (
                select  count(1) as cnt
                    	,case when session_state = 'ON CPU' then 'CPU'
                    	else event	end as activity_event
                    	,case when session_state = 'ON CPU' then 'CPU'
                    	else wait_class	end as activity_class
                from gv$active_session_history
                where nvl(wait_class,'NONE') <> 'Idle'
                  {str3}
                and sample_time between 
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
                       + ( 1 / 24 / 60 / 60 )/1000 * :1 
                     and 
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
                       + ( 1 / 24 / 60 / 60 )/1000 * :2 
                group by 
                        case when session_state = 'ON CPU' then 'CPU'
                        else wait_class	end
                    	,case when session_state = 'ON CPU' then 'CPU'
                    	else event end
             )
            --
            select
            	100*trunc(ratio_to_report(cnt) over(partition by activity_class),3) as pct
            	,counts.activity_event, counts.activity_class
            from counts""".format(str1=db_os_tz, str3=str3_instance)
			
    print(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )
    result_list=[ row for row in cursor.fetchall() ]
    cursor.close()
    return jsonify(result_list)


#--
# provide counts of wait classes in GV$ACTIVE_SESSION_HISTORY
#--  
@app.route('/wait_class_ash_detail', methods = ['POST'])
def wait_class_ash_detail():
    print("wait_class_ash_detail(): request.form:", request.form)
    post_data_dict=request.get_json()
    v_conn_name=request.form.get('conn_name')
    v_selected_instance=request.form.get('selected_instance')
    start_date=request.form.get('start_date')
    end_date=request.form.get('end_date')
    #print("date_range : ", start_date, end_date)
    
    con = get_db_connection(v_conn_name)
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
       
    cursor = con.cursor()
        
    str3_instance = "" if 'all' in str(v_selected_instance) else "and inst_id = "+str(v_selected_instance)

    v_sql="""
           	with counts as (
                select  count(1) as cnt
                    	,case when session_state = 'ON CPU' then 'CPU'
                    	else wait_class	end as activity_class
                from v$active_session_history
                where nvl(wait_class,'NONE') <> 'Idle'
                  {str3}
                and sample_time between 
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
                       + ( 1 / 24 / 60 / 60 )/1000 * :1 
                     and 
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str1}') as date)
                       + ( 1 / 24 / 60 / 60 )/1000 * :2 
                group by 
                        case when session_state = 'ON CPU' then 'CPU'
                        else wait_class	end
             )
            --
            select
            	100*trunc(ratio_to_report(cnt) over(),3) as pct
            	, counts.activity_class
            from counts
            order by 1 desc""".format(str1=db_os_tz, str3=str3_instance)
			
    print(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )
    result_list=[ row for row in cursor.fetchall() ]
    cursor.close()
    return jsonify(result_list)
