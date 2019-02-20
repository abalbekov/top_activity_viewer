import {gl}                    from "./globals.js"
import {getRACInstances}       from "./racInstanceSelector.js"
import {emptyGraph,buildGraph} from "./graph.js"
import {defineChartSrcSel}     from "./chartSourceSelector.js"
//import {loadSqlMonData,createSqlMonDataTable} from "./sqlMonitorDataTable.js"
import {activateLegend}			from "./legend.js"

export function defineConnections(){
	$.getJSON(gl.api_root+'/get_credentials', 
			  {},
			  // function called on data arrival
			  function(data) {
				var select2Data = [];
				// move arrived data to select2Data array
				data.forEach(function(item,idx){select2Data.push({id:idx, text:item})});
				// redefine connection selector element
				$('#conn_selector').select2({data: select2Data,  placeholder: "1. Pick database connection..."});
				
				// define actions to perform on connection selection 
				$('#conn_selector').on('select2:select', function (e) {
					gl.gDbCredential = e.params.data["text"];
					//$('#chart_stats').select2({placeholder: "... loading metrics ..."});
					// check how many RAC instances this connection has
					getRACInstances();
					getCpuCoreCount();
					// when connection is selected, 
					// clear chart and previously downloaded data
					gl.maxDownloadedDate=(new Date()).getTime()+30*24*60*60*1000; // fake date in the future
					gl.minDownloadedDate=gl.maxDownloadedDate;
					gl.gChartDataDetail=[];
					buildGraph();
					// enable chart source selector
					defineChartSrcSel();
					// enable chart source select (it is initially disabled)
					//$('#chart_source option').removeProp('disabled');
					//$('#chart_source').select2('destroy').select2();
					// enable legend interaction
					activateLegend();
				});

			  })
};

// function to get Cpu core counts; this will be used as upper boundary in the graph
function getCpuCoreCount(){
	$.post(gl.api_root+'/cpu_cores', 
		  {conn_name: gl.gDbCredential},
		  function(cpuCount) {
			gl.gCpuCoreCount=cpuCount;
		  }
	);
}
