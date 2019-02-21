                      # top_activity_viewer
A single page web application to display Oracle active session history 

This application is inspired by Oracle OEM Top Activity page 
and also by ASH Viewer tool ( https://github.com/akardapolov/ASH-Viewer )

Its goal is to take records from V$ACTIVE_SESSION_HISTORY and DBA_HIST_ACTIVE_SESS_HISTORY 
and then chart it in a browser as time series in interactive dyGraph [http://dygraphs.com/](http://dygraphs.com/)
and then let user to select a specific date range and then show more detailed information for this date range.

Example screenshot:

![Oracle Top Activity Viewer](https://github.com/abalbekov/top_activity_viewer/blob/master/Screenshot.PNG "Oracle Top Activity Viewer")

Using dyGraph makes analyzing time series fun and snappy - you can freely pan, zoom and select to focus on arbitrary date range.
The displayed time range is not limited to either 1hr or 24 hrs as in OEM.
The left and right panning is not limited to 24hr steps as in OEM.
The date range selection is not limited to 5 minutes interval as in OEM.

Compared to OEM this tool does not require setting up any dedicated middleware server.
The middleware component is lightweight Python cx_Oracle Flask application requiring very little resources.
It can run on laptop in CMD prompt, in a Docker container or in AWS cloud as combination of Lambda, API Gateway and S3 Static Website.

Flask application sends browser a single web page consisting of HTML, CSS and javascript.
Then the browser calls several API endpoints served by Flask to asynchronously retrieve time series data and render
it in dyGraph. The data is prefetched to cover slightly over what is visible in the chart. When user pans left or right, 
more data asyncroniously requested and spliced with already downloaded data. The python code uses streaming technique 
to avoid delay in handing over records from database to the browser.

The target database can be any Oracle database with Diagnostic and Tuning Pack.
The pack is necessary because it populates ASH tables with timeseries data used by this tool.
This means that without this option the tool will not have anything to show.

**Warning** - Diagnostic and Tuning Pack is separately licensable option of Oracle Enterprise Edition.

How to run on local PC : [How to run on local PC.log](https://github.com/abalbekov/top_activity_viewer/blob/master/how%20to%20run%20on%20local%20PC.log)

How to run with Docker : [How to run with Docker.log](https://github.com/abalbekov/top_activity_viewer/blob/master/how%20to%20run%20with%20Docker.log)


References: 
ASH Viewer https://github.com/akardapolov/ASH-Viewer
