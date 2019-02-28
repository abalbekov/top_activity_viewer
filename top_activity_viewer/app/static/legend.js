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
	let dgUpdateOptionTimerId;
	let highlightedWaitClassName;
	let highlightedWaitClassID;
	$('#legend ul')
		.addClass("active")
		.off('mouseenter')
		.on( 'mouseenter', 'li', function () {
			if (gl.gDbCredential) {
			// highlight time series after 0.3s timeout
				// save this wait class name in a closure to be visible in setTimeout callback
				let thisWaitClassName=this.textContent;
				let thisWaitClassID=this.id;
				clearTimeout(dgUpdateOptionTimerId);
				dgUpdateOptionTimerId=setTimeout(
					function(){
						// un-highlight previosly highlighted series
						if (highlightedWaitClassID) {
							gl.dg.colorsMap_[highlightedWaitClassName]=waitClassObj[highlightedWaitClassID][1];
							gl.dg.updateOptions({strokeWidth: 1});
						}
						// highlight this time series
						highlightedWaitClassName=thisWaitClassName;
						highlightedWaitClassID=thisWaitClassID;
						gl.dg.colorsMap_[thisWaitClassName]="#FFFF00"; //yellow
						var newOptions = {};
						newOptions[thisWaitClassName] = {strokeWidth: 1};
						gl.dg.updateOptions({series: newOptions});
					}
					,300);
				//stop bubbling
				return false;
			}}
		   )
		.off('mouseleave')
		//.on( 'mouseleave', 'li', function () {
		.on( 'mouseleave', function () {
			if (gl.gDbCredential) {
				// clear outstanding time series highlight request
				clearTimeout(dgUpdateOptionTimerId);
				// unhighlight time series if it was highlighted, with rather long delay
				// in a hope that it will be canceled before executing by mouseenter event
				dgUpdateOptionTimerId=setTimeout(
					function(){
						if (highlightedWaitClassID){
							gl.dg.colorsMap_[highlightedWaitClassName]=waitClassObj[highlightedWaitClassID][1];
							gl.dg.updateOptions({strokeWidth: 1});
						}
					}
					,100);
				//gl.dg.updateOptions({strokeWidth: 1});
				// unhighlight legend item
				//$(this).toggleClass(this.className).toggleClass("legend_"+this.id);
				//stop bubbling
				return false;
			}}
		  );
}
