import {gl}                     from "./globals.js"
import {emptyGraph, buildGraph} from "./graph.js"

// define chart source selector behavior
export function defineChartSrcSel(){

	// initially disable
	//$('#chart_source option').prop('disabled',true);
	$('#chart_source').select2({minimumResultsForSearch: Infinity});
	
	/* when metric source is changed : 
		 toggle chart data source title on web page 
	     clear downloaded data 
	     change visible chart date window
	     and redraw graph
	*/
	$('#chart_source').on('select2:select', function (e) {
		// toggle chart data source title on web page
		var selectedValue = e.params.data["text"];
		gl.gDataSource=selectedValue;
		$('.chart h2').text(selectedValue);

		// clear downloaded data
		gl.gChartDataDetail=[];
		gl.minDownloadedDate=gl.maxDownloadedDate;

		// change visible chart date window
		var newEnd=new Date();
		if (selectedValue=='v$active_session_history' 
			||
			selectedValue=='realtime v$session_wait' )
		{	// for details the source resolution is 1 mins
			// set window to 240*1 mins
			var newBegin=new Date( newEnd.getTime()-240*60*1000);
			var newRollPeriod=10;
			//var newEnd  =new Date( curRange[0].getTime()+curWidthMs+240*60*1000);
		}
		else {
			// for summary the source resolution is about 30min-1hr
			// set window to 240*30 mins
			var newBegin=new Date( newEnd.getTime()-240*30*60*1000);
			var newRollPeriod=3;
		}

		// and redraw graph
		gl.dg.updateOptions({
						 file      : [[newBegin,0],[newEnd,0]]
						,dateWindow: [newBegin.getTime(),newEnd.getTime()]
						,rollPeriod: newRollPeriod});
		buildGraph();
		//defineLabels();
	});
	
}
