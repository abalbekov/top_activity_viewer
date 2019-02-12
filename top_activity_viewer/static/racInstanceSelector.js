// function to create RAC instance select list
// determines how many RAC instances db has and populates select options

import {gl}         from "./globals.js"
//import {stackMetric,unstackMetric} from "./metricsSelector.js"
import {buildGraph} from "./graph.js"

export function getRACInstances(){
	
	$.post(gl.api_root+'/rac_instances', 
		  {conn_name: gl.gDbCredential},
		  function(racInstanceCnt) {
			gl.gRacInstanceCnt=racInstanceCnt;
			if (racInstanceCnt > 1) {
				//$("#rac_instance1").empty();
				
				var select2Data = [{id:1,text:"RAC Instances: All(Aggregate)"},
								   {id:2,text:"RAC Instances: All(Stacked)"}]			
				for (var i=1; i<=racInstanceCnt; i++ ){
					select2Data.push({id:i+2,text:"Instance"+toString(i),instNumber:i});
				}
				$('#rac_instance1').select2({data: select2Data});
				
				$('#rac_instance1').on('select2:select', function (e) {
					if (e.params.data["text"]=="RAC Instances: All(Aggregate)"){
						gl.gRacInstSelected='all-aggregate';
						unstackMetric(); 
					} else if (e.params.data["text"]=="RAC Instances: All(Stacked)"){
						gl.gRacInstSelected='all-stacked';
						stackMetric(); 
					} else {
						gl.gRacInstSelected=e.params.data["instNumber"];
						unstackMetric(); 
					};
					buildGraph();
				});
				$("#rac_instance1").show();
			} else {
				$("#rac_instance1").hide();
			}
		  }
	);
};
