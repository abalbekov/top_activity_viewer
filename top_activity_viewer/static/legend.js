// module to define Legend section behavior

import {gl,waitClassObj}	from "./globals.js"
import {buildGraph} 		from "./graph.js"

// function to add List Items from global object waitClassObj to "Legend" UL element 
export function defineLegend(){
	for (let k of Object.keys(waitClassObj)){
		let $newListItem=$('<li id="'+k+'">'+waitClassObj[k][0]+'</li>');
		$newListItem.addClass('legend_'+k);
		$('#legend ul').append($newListItem);
	}
}
	
// enable interaction on Legend items
export function activateLegend(){
	// for mouse over list item highlight corresponding timeseries on the chart
	$('#legend ul')
		.addClass("active")
		.off('mouseenter')
		.on( 'mouseenter', 'li', function () {
			if (gl.gDbCredential) {
				// highlight time series
				gl.dg.colorsMap_[this.textContent]="#FFFF00"; //yellow
				var newOptions = {};
				newOptions[this.textContent] = {strokeWidth: 1};
				gl.dg.updateOptions({series: newOptions});
				// highlight legend item
				$(this).toggleClass(this.className).toggleClass("legend_highlighted");
				//stop bubbling
				return false;
			}}
		   )
		.off('mouseleave')
		.on( 'mouseleave', 'li', function () {
			if (gl.gDbCredential) {
				// unhighlight time series
				gl.dg.colorsMap_[this.textContent]=waitClassObj[this.id][1];
				gl.dg.updateOptions({strokeWidth: 1});
				// unhighlight legend item
				$(this).toggleClass(this.className).toggleClass("legend_"+this.id);
				//stop bubbling
				return false;
			}}
		  )
		 .off('click')
		 .on('click', 'li', function(){
				if (gl.gDbCredential && gl.gSelectedWaitClass=='all') {		 
					gl.gSelectedWaitClass=this.id;
					// build wait events list for this specific wait class 
					defineEventsLegend();
				}
			}
		 );
}

function defineEventsLegend (){
	let waitClassText=waitClassObj[gl.gSelectedWaitClass][0]
	let waitClassColor=waitClassObj[gl.gSelectedWaitClass][1]
	
	// clear wait class items
	$('#legend ul li').remove();

	// take off active class (i.e. text underline )
	$('#legend ul').removeClass("active");

	// replace Legend heading
	//$('#legend h2').text("Activity: "+waitClassText);
	
	// add legend subtitle
	let $subTitle=$('<h4><span>Wait Class: </span>'+ waitClassText +'</h4>');
	$($subTitle).insertAfter('#legend h2');

	// retrieve from db list of events for gl.gSelectedWaitClass
	// and build wait events list in Legend element
	$.ajax(	{method: 'post'
			,url: gl.api_root+'/wait_events'
			,data: JSON.stringify(
					{ conn_name : gl.gDbCredential
						,wait_class: waitClassText
						,date_range: [gl.minDownloadedDate, gl.maxDownloadedDate]
						,browzer_tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone
					}
				)
			,contentType: 'application/json'
			}
	)
	.done( function(eventList) {
				console.log(eventList);
				gl.gSelectedWaitEvents=eventList;
				// build events legend ul
				for (let k of eventList){
					let $newListItem=$('<li id="'+k+'">'+k+'</li>');
					//$newListItem.addClass('legend_'+k);
					$('#legend ul').append($newListItem);
				}
				// clear downloaded chart data 
				gl.gChartData=[];
				// do not change visible chart date window
				// for initially empty graph fake downloaded date in the future
				gl.maxDownloadedDate=new Date().getTime()+30*24*60*60*1000;
				gl.minDownloadedDate=gl.maxDownloadedDate;
				// change chart title
				$('.chart h2').text(gl.gDataSource+' : Wait Class "'+waitClassText+'"');
				// redraw graph
				buildGraph();
				// enable interactive legend
				activateLegend();
			}
		);
}
