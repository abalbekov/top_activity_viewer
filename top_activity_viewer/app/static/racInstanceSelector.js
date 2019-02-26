// function to create RAC instance select list
// determines how many RAC instances db has and populates select options

import {gl}         from "./globals.js"
import {buildGraph} from "./graph.js"

export function getRACInstances(){
	
	$.post(gl.api_root+'/rac_instances', 
		{conn_name: gl.gDbCredential},
		 function(racInstanceCnt) {
			gl.gRacInstanceCnt=racInstanceCnt;
			if (racInstanceCnt > 1) {
				var select2Data = []			
				for (let i=1; i<=racInstanceCnt; i++ ){
					select2Data.push({id:i+2,text:"Instance"+String(i),instNumber:i});
				};
				
				$('#rac_instance1')
				.select2({data: select2Data,minimumResultsForSearch: Infinity})
				.on('select2:select', function (e) {
					if (e.params.data["text"]=="RAC Instances: All"){
						gl.gRacInstSelected='all';
					} else {
						gl.gRacInstSelected=e.params.data["instNumber"];
					};
					// clear downloaded data
					gl.gChartData=[];
					// for initially empty graph fake downloaded date in the future
					gl.maxDownloadedDate=new Date().getTime()+30*24*60*60*1000;
					gl.minDownloadedDate=gl.maxDownloadedDate;
					buildGraph();
				})
				.show();
				
			} else {
				$("#rac_instance1").select2().next().hide();
			}
		}
	);
};
