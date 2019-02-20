import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import json
from time import sleep
import datetime
import os

#--
# provide detailed wait events chart data sourced from V$ACTIVE_SESSION_HISTORY
# for specific wait_class
#--  
#@app.route('/chart_data_wait_events_ash_detail', methods = ['POST'])
def chart_data_wait_events_ash_detail():
#    M1.chart_data_wait_events_ash_detail()
    post_data_dict=request.get_json()
    print(post_data_dict)
        # this gives {'conn_name': 'ewdb_ste_system', 'selected_instance':'1' ,'metric_names': ['some metric_name','DB Block Changes Per Sec - Derived']}
    v_conn_name=post_data_dict['conn_name']
    v_selected_instance=post_data_dict['selected_instance']

    start_date=post_data_dict['date_range'][0]
    end_date  =post_data_dict['date_range'][1]
    #print("date_range : ", start_date, end_date)
    
    #browser_tz_offset_sec=post_data_dict['browser_tz_offset_sec']
    #print("browser_tz_offset_sec :", browser_tz_offset_sec)
    browzer_tz_name      =post_data_dict['browzer_tz_name']
    #print("browzer_tz_name : ", browzer_tz_name)

    wait_class=post_data_dict['wait_class']
    print("wait_class: ", wait_class)
    
    con = get_db_connection(v_conn_name)
    
    db_os_tz = conn_dict[v_conn_name]["db_os_tz"]
       
    cursor = con.cursor()
    cursor.arraysize = 50
    
    # determine how many instances are there
    cursor.execute("""select count(1) from gv$instance""")
    rec = cursor.fetchone()
    v_rac_instances = rec[0]
    print ('v_rac_instances:', v_rac_instances)

    # get list of top 10 events for given wait class within date range:
    v_sql="""select event from (
             select count(1), event
             from v$active_session_history
             where wait_class = '{str1}'
                 and sample_time between
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                     + ( 1 / 24 / 60 / 60 )/1000 * :1
                     and 
                     cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                     + ( 1 / 24 / 60 / 60 )/1000 * :2
             group by event
             order by 1 desc
             ) where rownum <= 10""".format(str1=wait_class, str2=browzer_tz_name)
    print(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )
    str_pivot_in=",".join( [ "'"+str(r[0])+"'" for r in cursor.fetchall() ] )
    print("str_pivot_in: ",str_pivot_in)
    
    v_sql="""
            with pivot_data AS (
                -- we divide count by 5 because we aggregate over 5-sec interval
                -- and ASH has samples on every second
                -- If we did not divide then single active session would count 5 times
                select count(1)/5 as active_sessions
                        -- we aggregate over 5 sec because 1 sec is too much detailed for browser graph.
                        -- we convert sample time from db OS time zone to browser time zone 
                    ,to_char(
                        from_tz(sample_time,'{str1}') at time zone '{str2}'
                            - mod(extract(second from sample_time), 5)/60/60/24 
                        , 'YYYY/MM/DD HH24:MI:SS')
                    as sample_time_browser_tz_5sec
                    ,event
                from v$active_session_history 
                where wait_class =  '{str3}'
                    -- we focus on date range corresponding browser-supplied UTC milliseconds
                    -- we convert from UTC to db OS time zone
                and sample_time between
                    cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                    + ( 1 / 24 / 60 / 60 )/1000 * :1
                    and 
                    cast((from_tz(cast(DATE '1970-01-01' as timestamp),'00:00') at time zone '{str2}') as date)
                    + ( 1 / 24 / 60 / 60 )/1000 * :2
                group by 
                    to_char(
                        from_tz(sample_time,'{str1}') at time zone '{str2}'
                            - mod(extract(second from sample_time), 5)/60/60/24 
                        , 'YYYY/MM/DD HH24:MI:SS')
                    ,event
                )
            --
            -- pivot below
            --
            select * from pivot_data
            pivot
            ( sum(active_sessions)
            for event
                in  ({str4})
            )
            order by sample_time_browser_tz_5sec desc""".format(str1=db_os_tz, str2=browzer_tz_name,str3=wait_class,str4=str_pivot_in)

    print(v_sql)
    cursor.execute(v_sql, (start_date, end_date) )
    columns = [i[0] for i in cursor.description]
    
    # using streaming response technique 
    # per http://flask.pocoo.org/docs/0.10/patterns/streaming/#basic-usage

    # returning Array-formatted stream
    def generate():
        yield "[\n"+json.dumps(columns)+"\n"
        sleep(0.05)         
        #row = cursor.fetchone()
        #ret="[\n"+json.dumps(row)+"\n"
        #yield ret
        #sleep(0.05)         
        for row in cursor:
            ret=","+json.dumps(row)+"\n"
            yield ret
        yield "]"
    return Response(generate(), mimetype='application/json')


# for testing    
#if __name__ == '__main__' :
        