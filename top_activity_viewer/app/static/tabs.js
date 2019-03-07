import {gl, waitClassObj}	from "./globals.js"


// define tabs vehavior
export function defineTabs() {
	jQuery('.tabs .tab-links a').on('click', function(e)  {
		var currentAttrValue = jQuery(this).attr('href');
	
		// Show/Hide Tabs
		jQuery('.tabs ' + currentAttrValue).show().siblings().hide();
	
		// Change/remove current tab to active
		jQuery(this).parent('li').addClass('active').siblings().removeClass('active');
	
		e.preventDefault();
	});
}

// define Wait Class - Wait Events tab behavior
var rangeWaitClassObj={};
export function defineWaitEventsTab(){
	// retrieve wait class counts for selected date range
	$.post(gl.api_root+'/wait_class_ash_detail'
		,{   "conn_name": 			gl.gDbCredential
		 	,"selected_instance": 	gl.gRacInstSelected
		 	,"start_date":			gl.selectedDateWindow[0]
		 	,"end_date":			gl.selectedDateWindow[1]
	    }
		,function(res) {
			//console.log(res);
			// ret is array of arrays [percent, wait_class]
			// like [100, Commit"]
			// convert ret array to object with key=wait_class
			rangeWaitClassObj={};
			let waitClass=undefined;
			res.forEach(function(s,idx){ 
					waitClass=s[1];
					rangeWaitClassObj[waitClass]=[s[0]];
				});

			// clear left and right columns
			$('#tab2 div.left-column ul').empty();
			$('#tab2 div.right-column p').html("select Wait Class on left to display Events");

			for (let k of Object.keys(rangeWaitClassObj)){
				let $newListItem=$('<li>'+k+'</li>');
				$newListItem.prepend('<span>'+rangeWaitClassObj[k]+'% </span>');
				let $newCanvas=$('<canvas width="50" height="10"></canvas>')
				let jsCanvas=$newCanvas[0];
				let ctx=jsCanvas.getContext("2d");
				ctx.fillStyle=Object.values(waitClassObj).filter(function(el){return el[0]===k})[0][1];
				ctx.fillRect(0, 0, 1+45*rangeWaitClassObj[k]/100, 10);
				$newListItem.prepend($newCanvas);
				$newListItem.on('click',{waitEvent: k}, displayEventNames);

				$('#tab2 div.left-column ul')
				.append($newListItem);
			}

			// retrieve event counts for selected date range
			// and attach event names and counts to wait class names in rangeWaitClassObj
			$.post(gl.api_root+'/wait_events_ash_detail'
				,{ 	 "conn_name": 			gl.gDbCredential
				 	,"selected_instance": 	gl.gRacInstSelected
				 	,"start_date":			gl.selectedDateWindow[0]
				 	,"end_date":			gl.selectedDateWindow[1]
				}
				,function(res) {
					// res is array of arrays [pct, event_name, wait_class_name]
					for (let waitClass of Object.keys(rangeWaitClassObj)){
						rangeWaitClassObj[waitClass][1]={};
						res.forEach(function(s,idx){ 
							let eventPct=s[0];
							let eventName=s[1];
							if (s[2]==waitClass){
								rangeWaitClassObj[waitClass][1][eventName]=eventPct;
							};
						});
					}
				}
			);
		}
	);

	// display event names on right side of the tab
	function displayEventNames(e){
		let txt="<pre>Wait Class: "+e.data.waitEvent+"<br>";
		txt=txt+ "-".repeat(e.data.waitEvent.length+12)+"<br>";
		let eventObj=rangeWaitClassObj[e.data.waitEvent][1];
		for (let eventName of Object.keys(eventObj)){
			txt=txt+eventName+": "+eventObj[eventName]+"% <br>"
		};
		txt=txt+"</pre>";
		$('#tab2 .right-column p').html(txt);
	}


}