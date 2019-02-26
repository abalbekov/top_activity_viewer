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
		  );
}
