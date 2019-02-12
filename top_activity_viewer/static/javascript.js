import {gl}                      			from "./globals.js"
//import {defineTabs}            			from "./tabs.js"
import {defineChartSrcSel}     				from "./chartSourceSelector.js"
import {emptyGraph,buildGraph,defineLegend}	from "./graph.js"
import {defineConnections}     				from "./dbConnectionSelector.js"

jQuery(document).ready(function() {
	
	defineConnections()
	emptyGraph();
	defineLegend();
	
	// make RAC instance selection initially invisible
	// make chart source selection initially invisible
	$("form#rac_instance").hide();
	$("#chart_source").hide();
	
	// position and hide spinner-loader
	var loaderTop =gl.dg.height_/2 - $(".loader").outerHeight()/2 - gl.dg.attrs_.xLabelHeight ;
	var loaderLeft=gl.dg.width_/2  - $(".loader").outerWidth()/2  + gl.dg.attrs_.yLabelWidth  ;
	$(".loader").css({ left: loaderLeft });
	$(".loader").css({ top : loaderTop  });
	$(".loader").hide();
	
});