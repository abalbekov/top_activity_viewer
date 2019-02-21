import {gl}                      			from "./globals.js"
//import {defineTabs}            			from "./tabs.js"
import {defineChartSrcSel}     				from "./chartSourceSelector.js"
import {emptyGraph,buildGraph}				from "./graph.js"
import {defineConnections}     				from "./dbConnectionSelector.js"
import {defineLegend,activateLegend}		from "./legend.js"

jQuery(document).ready(function() {
	
	defineConnections()
	emptyGraph();
	defineLegend();
	
	// make RAC instance selection initially invisible
	// make chart source selection initially invisible
	$("#rac_instance").hide();
	$("#chart_source").hide();
	
	// position and hide spinner-loader
	var loaderTop =gl.dg.height_/2 - $(".loader").outerHeight()/2 - gl.dg.attrs_.xLabelHeight ;
	var loaderLeft=gl.dg.width_/2  - $(".loader").outerWidth()/2  + gl.dg.attrs_.yLabelWidth  ;
	$(".loader").css({ left: loaderLeft });
	$(".loader").css({ top : loaderTop  });
	$(".loader").hide();

	// zoom control click handler
	$("#zoom .fa-plus-square-o").click(function(){
		gl.gMaxYValue=gl.dg.yAxisRange()[1]/2;
		gl.dg.updateOptions({valueRange: [0, gl.gMaxYValue]});
	});
	$("#zoom .fa-minus-square-o").click(function(){
		gl.gMaxYValue=gl.dg.yAxisRange()[1]*2;
		gl.dg.updateOptions({valueRange: [0, gl.gMaxYValue]});
	});
	
	// pan/select control click handler
	$("#pan-select-toggle").click(function(){
		var $icon=$(this).children(":first");
		if ( gl.panSelectToggle=='select' ) {
			 $icon.removeClass("fa-stop-circle-o")
				  .toggleClass("fa-stop-circle");
			 $(this).children("span").text("Pan");
			 gl.panSelectToggle='pan';
		}
		else if ( gl.panSelectToggle='pan' ) {
			 $icon.removeClass("fa-stop-circle")
			      .toggleClass("fa-stop-circle-o");
			 $(this).children("span").text("Sel");
			 gl.panSelectToggle='select';
		};
	});
	
});