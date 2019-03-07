// module to define graph behaviour

import {gl, waitClassObj}       	from "./globals.js"
import {activateLegend}				from "./legend.js"
import {defineWaitEventsTab}		from "./tabs.js"

// function to draw empty starter graph
export function emptyGraph() {
	
	// initial data is two zero points 30 mins apart for detailed ...
	if ((gl.gDataSource == "v$active_session_history")
	   ||
	   (gl.gDataSource == "rt_v$active_session_history"))
	{
		var startTime=new Date( (new Date()).getTime()-30*60*1000 );
		var endTime=new Date();
	} else if (gl.gDataSource == "dba_hist_active_sess_history")
	{ // or 6hrs apart if summary ...
		var startTime=new Date( (new Date()).getTime()-6*60*60*1000 );
		var endTime=new Date();
	}

	// for initially empty graph fake downloaded date in the future
	gl.maxDownloadedDate=startTime.getTime()+30*24*60*60*1000;
	gl.minDownloadedDate=gl.maxDownloadedDate;
	
	// define interaction model object
	var interactionModel= {
		'mousedown': function (event, g, context){
				context.initializeMouseDown(event, g, context);
				if (gl.panSelectToggle=='select'){
					// clear any highlights
					g.updateOptions({ underlayCallback: null });
					// clear "selected range ..." wording
					$("#selected_range").hide();
					// clear underchart tabs
					$("#tabs_outer").hide();
				}
				
				if (gl.panSelectToggle=='select') {
					Dygraph.startZoom(event, g, context);
				}
				else if (gl.panSelectToggle=='pan'){
					Dygraph.startPan(event, g, context);
				}
				// save current range for later
				gl.mouseDownDateWindow=gl.dg.xAxisRange();
		},
			
		'mousemove': function (event, g, context){
			if (gl.panSelectToggle=='select' && context.isZooming) {
				Dygraph.moveZoom(event, g, context);
			}
			else if (gl.panSelectToggle=='pan' && context.isPanning){
				context.is2DPan = false; // pan only along X axis
				Dygraph.movePan(event, g, context);
		}},
			
		'mouseup'  : function (event, g, context){
			if (gl.panSelectToggle=='select' && context.isZooming ){
				Dygraph.endZoom(event, g, context);
				// only consider it a selection if mouseup is not too close to mousedown
				if ((g.xAxisRange()[0]-gl.mouseDownDateWindow[0]) /
				    (g.xAxisRange()[1]-g.xAxisRange()[0]) > 0.05 ) {
						// effectively cancel zooming by redrawing with intial mousedown date range
						// and highlight zoomed area
						gl.selectedDateWindow=g.xAxisRange();
						gl.dg.updateOptions({
							dateWindow: gl.mouseDownDateWindow
							,underlayCallback: function(canvas, area, g) {
								var bottom_left = g.toDomCoords(gl.selectedDateWindow[0], -20);
								var top_right = g.toDomCoords(gl.selectedDateWindow[1], +20);
								var left = bottom_left[0];
								var right = top_right[0];
								//canvas.fillStyle = "rgba(255, 204, 0, 1.0)";
								canvas.fillStyle = "#FFD37F";
								canvas.fillRect(left, area.y, right - left, area.h);
							}
						});
						// print selected date range under the chart
						$("#selected_range").text("Selected Range:"+
												   new Date(gl.selectedDateWindow[0]).toString()+
												   " - "+
												   new Date(gl.selectedDateWindow[1]).toString())
						.show();
						defineWaitEventsTab();
						// show underchart tabs
						$("#tabs_outer").show();
					}
			}
			else if (gl.panSelectToggle=='pan' && context.isPanning){
				Dygraph.endPan(event, g, context);
			}
		}
	};

	gl.dg = new Dygraph(
		document.getElementById("chart_dygraph")
		,[[startTime,0],[endTime,0]]
		,{ylabel: 				'Active Sessions'
		 ,labels:				['A','B']
		 ,dateWindow: 			[startTime.getTime(), endTime.getTime()]
		 ,interactionModel:		interactionModel
		 ,showRoller: 			true
		 ,rollPeriod: 			10
		 ,fillGraph : 			true
         ,fillAlpha:  			1.0
         ,stackedGraph:			true
         ,stackedGraphNaNFill:	"none"
		 ,showLabelsOnHighlight:false
		 ,panEdgeFraction: 		0.1
		 ,strokeWidth: 			1
		}
	);

	// separately add Range Selector so that interactionModel is not lost
	gl.dg.updateOptions({showRangeSelector: true});
	
	// add custom mouseup handler to request more data
	$("#chart_dygraph canvas, .dygraph-rangesel-fgcanvas, .dygraph-rangesel-zoomhandle")
		.mouseup(function(e) {
            //console.log("mouseup detected");
			// if the pan action moved chart to the edge beyond 
			// data received from datasource so far,
			// then request more data
			if ( gl.dg.xAxisRange()[0]<gl.minDownloadedDate
				  || 
				  gl.dg.xAxisRange()[0]>gl.maxDownloadedDate )
			{
				buildGraph();
			};
		});
}

// function to download chart data and re-render the graph
export function buildGraph(){

		// prepare POST parameters for Ajax request
		let metricsObj = {};
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
					//,showRangeSelector: true
					,valueRange:		[0, gl.gMaxYValue]
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
				gl.dg.updateOptions({file: displayData, valueRange: [0, gl.gMaxYValue]});
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
