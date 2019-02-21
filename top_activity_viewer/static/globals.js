// store and exchange Globals between modules
let gl={ 
     'gDbCredential'        : ""
	,'gRacInstSelected'     : 'all'	// can be 'all' or instance number
	,'gRacInstanceCnt'      : 1
	,'gCpuCoreCount'		: 1
	,'gDataSource'          : 'v$active_session_history'
	//,'gDbaHistSourcexAxisRange':[]
	,'gChartData'           : [] // data loaded so far
	,'dg'                   : {} // dygraph object
	,'maxDownloadedDate'    : undefined
	,'minDownloadedDate'    : undefined
	,'api_root'				: ''
	//,'api_root'			: 'https://u6pic3x198.execute-api.us-east-1.amazonaws.com/dev'
	,'panSelectToggle'		: 'pan'
	,'mouseDownDateWindow'	: []
	,'selectedDateWindow'	: []
};

let waitClassObj={
	 'other'         : ["Other"			,"#F16DAE"]
	,'clustr'        : ["Cluster"		,"#D2C2B3"]
	,'queueing'      : ["Queueing"		,"#C5B6A0"]
	,'network'       : ["Network"		,"#9D9169"]
	,'administrative': ["Administrative","#6B7051"]
	,'configuration' : ["Configuration"	,"#604300"]
	,'commit'        : ["Commit"		,"#E76805"]
	,'application'   : ["Application"	,"#C22B08"]
	,'concurrency'   : ["Concurrency"	,"#8B1902"]
	,'system_io'     : ["System I/O"	,"#0094EC"]
	,'user_io'       : ["User I/O"		,"#004CE6"]
	,'scheduler'     : ["Scheduler"		,"#84FA8E"]
	,'cpu'           : ["CPU"			,"#00BB00"]
};

export {gl};
export {waitClassObj};
