import cx_Oracle
from flask import request, Response, jsonify, Flask, g
import os
from app import app

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
    
