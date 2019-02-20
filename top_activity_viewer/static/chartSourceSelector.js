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
		gl.gChartData=[];
		
		// change visible chart date window
		var newEnd=new Date();
		if (selectedValue=='v$active_session_history' )
		{	// for details set window to 1hr
			var newBegin=new Date( newEnd.getTime()-60*60*1000);
			var newRollPeriod=10;
		}
		else {
			// for dba_hist_active_sess_history set window to 6hrs
			var newBegin=new Date( newEnd.getTime()-6*60*60*1000);
			var newRollPeriod=3;
		}

		// for initially empty graph fake downloaded date in the future
		gl.maxDownloadedDate=newBegin.getTime()+30*24*60*60*1000;
		gl.minDownloadedDate=gl.maxDownloadedDate;

		// and redraw graph
		gl.dg.updateOptions({
						 file      : [[newBegin,0],[newEnd,0]]
						,labels    : ['A','B']
						,dateWindow: [newBegin.getTime(),newEnd.getTime()]
						,rollPeriod: newRollPeriod});
		buildGraph();
		//defineLabels();
	});
	
}
