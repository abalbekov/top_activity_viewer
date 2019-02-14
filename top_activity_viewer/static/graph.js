// module to define graph behaviour

import {gl, waitClassObj}        from "./globals.js"

// function to draw empty starter graph
export function emptyGraph() {
	
	// initial data is two zero points 1hr apart for detailed ...
	if ((gl.gDataSource == "v$active_session_history")
	   ||
	   (gl.gDataSource == "rt_v$active_session_history"))
	{
		var startTime=new Date( (new Date()).getTime()-60*60*1000 );
		var endTime=new Date();
	} else if (gl.gDataSource == "dba_hist_active_sess_history")
	{ // or 6hrs apart if summary ...
		var startTime=new Date( (new Date()).getTime()-6*60*60*1000 );
		var endTime=new Date();
	}

	// for initially empty graph fake downloaded date in the future
	gl.maxDownloadedDate=startTime.getTime()+30*24*60*60*1000;
	gl.minDownloadedDate=gl.maxDownloadedDate;
	
	gl.dg = new Dygraph(
		document.getElementById("chart_dygraph")
		,[[startTime,0],[endTime,0]]
		,{ylabel: 				'Active Sessions'
		 ,labels:				['A','B']
		 ,dateWindow: 			[startTime.getTime(), endTime.getTime()]
		 ,showRangeSelector: 	true
		 ,showRoller: 			true
		 ,rollPeriod: 			10
		 ,fillGraph : 			true
         ,fillAlpha:  			1.0
         //,stepPlot:			true
         ,stackedGraph:			true
         ,stackedGraphNaNFill:	"none"
		 ,showLabelsOnHighlight:false
		 ,panEdgeFraction: 		0.1
		 ,strokeWidth: 			1
		}
	);

	// add zoom elements
	
	
	
	// add custom mouseup handler to request more data
	$("#chart_dygraph canvas, .dygraph-rangesel-fgcanvas, .dygraph-rangesel-zoomhandle")
		.mouseup(function(e) {
            //console.log("mouseup detected");
			// if datasource is history
			// and if the pan action moved chart to the edge beyond 
			// data received from datasource so far,
			// then request more data
			//if (gl.gDataSource=='v$active_session_history'
			//	&&
			if ( gl.dg.xAxisRange()[0]<gl.minDownloadedDate
				  || 
				  gl.dg.xAxisRange()[0]>gl.maxDownloadedDate )
			{
				buildGraph();
			};
		})
		.mousedown(function(e) {
            console.log("mousedown detected");
		});
}

// function to download chart data and re-render the graph
export function buildGraph(){

		// prepare POST parameters for Ajax request
		var metricsObj = {};
		metricsObj["conn_name"]        =gl.gDbCredential;
		metricsObj["selected_instance"]=gl.gRacInstSelected;
		metricsObj["date_range"]       =getDateRangeMs();
		metricsObj["browser_tz_offset_sec"] =new Date().getTimezoneOffset()*60;
		metricsObj["browzer_tz_name"]       =Intl.DateTimeFormat().resolvedOptions().timeZone;
		
		if (gl.gDataSource=='v$active_session_history')
			{var url=gl.api_root+"/chart_data_ash_detail";}
		else if (gl.gDataSource=='rt_v$active_session_history')
			{var url=gl.api_root+"/chart_data_rt_ash_detail";}
		else if (gl.gDataSource=='dba_hist_active_sess_history')
			{var url=gl.api_root+"/chart_data_ash_summary";}
		else
			{// we should not be here
			return;
		};
		
		//extract Labels and Colors from global waitClassObj
		var labelsArr=[];
		var colorsArr=[];
		for (let v of Object.values(waitClassObj)){
			labelsArr.push(v[0]);
			colorsArr.push(v[1]);
		}
		labelsArr.unshift("sample_time_browser_tz");

		var xhr = new XMLHttpRequest();
		xhr.open("POST", url);
		xhr.setRequestHeader('Content-Type','application/json');
		// update graph display along the way
		xhr.onprogress = function (e) {
			$(".loader").hide();
			var displayData;
			var newData=csvToArray(this.responseText);
			//if (gl.gDataSource=='v$active_session_history'){
				// for detailed chart we download only portion
				// since full range may take too long
				// here we splice newly downloaded data with previously downloaded 
				// (stored in gChartDataDetail)
				// and display spliced data 
				displayData=spliceData(newData,gl.gChartData);
			//} else {
			//	displayData=newData;
			//};
			// update chart if there is anything to display
			if (displayData.length > 0){
				gl.dg.updateOptions({
					file: 				displayData
					,labels: 			labelsArr
					,colors:			colorsArr
					,showRangeSelector: true
					,valueRange:		[0, gl.gCpuCoreCount]
				});
			}
		};
						
		//xhr.onloadstart = function (e) {
		//	createSqlMonDataTable();
		//}
		
		// in case "onprogress" was not called for last few bits of incoming data
		xhr.onloadend = function (e) {
			var displayData;
			var newData=csvToArray(this.responseText);
			//if (gl.gDataSource=='v$active_session_history'){
				gl.gChartData=spliceData(newData,gl.gChartData);
				displayData=gl.gChartData;
			//} else {displayData=newData;};
			if (displayData.length > 0){
				gl.dg.updateOptions({file: displayData});
			}
		}
	
		$(".loader").show();
		xhr.send(JSON.stringify(metricsObj));
		//console.log(JSON.stringify(metricsObj));
}

// Function to determine chart date range to extract from backend.
// This is different from visible chart date range
// because we will pre-fetch data.
//
// At first we will expand the visible range by its width on left and right.
// Then we will determine if part of this range was already loaded
// and if it was then adjust to reduce the range for subsequent splice.
//
// Returns millisec since epoch
//
function getDateRangeMs() {
	//var tzOffsetMs=new Date().getTimezoneOffset()*60*1000;
	// following https://danielcompton.net/2017/07/06/detect-user-timezone-javascript
	//tzName=Intl.DateTimeFormat().resolvedOptions().timeZone;
	
	var beginDate=gl.dg.xAxisRange()[0];
	var endDate=gl.dg.xAxisRange()[1];
	var width=endDate-beginDate;

	// expand range by window width
	beginDate-=2*width;
	endDate  +=2*width;
	// reduce range by amount of already downloaded data
	if (beginDate < gl.minDownloadedDate) {
		endDate  = Math.min(endDate,   gl.minDownloadedDate-1000);
	}
	if (endDate > gl.maxDownloadedDate) {
		beginDate  = Math.max(beginDate,   gl.maxDownloadedDate+1000);
	}
	// end date can not be in the future
	endDate = Math.min(endDate, (new Date()).getTime());

	//return [beginDate-tzOffsetMs, endDate-tzOffsetMs];
	return [beginDate, endDate];
}
	
// convert CSV text to array
function csvToArray(csvData) {					
	try { 
		var csvData = JSON.parse(csvData);
	} catch(e) {
		// for incomplete stream discard anything after last new line
		// and add closing "]"
		csvData=csvData
				.substring(0,csvData.lastIndexOf('\n'))
				+"]";
		csvData = JSON.parse(csvData);
	}
	// remove "falsy" items
	csvData=csvData.filter(Boolean);

	// convert first column string to Date
	csvData.forEach(function(s,idx){ 
		csvData[idx][0]=new Date(s[0]);
	});

	// convert null to 0
	csvData.forEach(function(s,idx){ 
		s.forEach(function(el,sIdx){
			csvData[idx][sIdx]=el||0;
		});
	});

	// sort by Date
	csvData.sort(function(a,b){return a[0]-b[0];})
	return csvData;
}
    
// function to splice new data array and previously downloaded data array
function spliceData(newData,oldData) {
	
	if (newData.length == 0) { 
		//new data is empty - nothing to splice
		return oldData;
	}
	if (oldData.length == 0) { 
		//old data is empty - return new data
	} else {
		// both old and new data are not empty
	
		// find min/max dates in newData
		// dates are in the first element of the 2d array
		var newDateArr=newData.map(function(value,index) { return value[0]; });
		var newDateMin=Math.min.apply(null,newDateArr);
		var newDateMax=Math.max.apply(null,newDateArr);
		
		// remove range from oldData
		oldData.filter(function(item){
			return (item[0] < newDateMin || item[0] > newDateMax)
		});
		
		// combine and sort by Date
		newData=newData.concat(oldData)
			.sort(function(a,b){
						return a[0]-b[0];
					});
	}			
	// save new min/max downloaded dates and newData
	gl.maxDownloadedDate=(newData[newData.length-1][0]).getTime();
	gl.minDownloadedDate=(newData[0][0]).getTime();
	gl.gChartData=newData;
	return newData;
}

// function to add List Items from global object waitClassObj to "Legend" UL element 
export function defineLegend(){
	for (let k of Object.keys(waitClassObj)){
		let $newListItem=$('<li id="'+k+'">'+waitClassObj[k][0]+'</li>');
		$newListItem.addClass('legend_'+k);
		$('#legend ul').append($newListItem);
	}
	// for mouse over list item highlight corresponding timeseries on the chart
	$('#legend ul')
		.off('mouseenter')
		.on( 'mouseenter', 'li', function () {
			// highlight time series
			gl.dg.colorsMap_[this.textContent]="#FFFF00"; //yellow
			var newOptions = {};
			newOptions[this.textContent] = {strokeWidth: 1};
			gl.dg.updateOptions({series: newOptions});
			// highlight legend item
			$(this).toggleClass(this.className).toggleClass("legend_highlighted");
			//stop bubbling
			return false;}
		   )
		.off('mouseleave')
		.on( 'mouseleave', 'li', function () {
			// unhighlight time series
			gl.dg.colorsMap_[this.textContent]=waitClassObj[this.id][1];
			gl.dg.updateOptions({strokeWidth: 1});
			// unhighlight legend item
			$(this).toggleClass(this.className).toggleClass("legend_"+this.id);
			//stop bubbling
			return false;}
		  );
   }

