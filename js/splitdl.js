/*
 * SplitDl-JS
 * Downloads a file in simultaneous chunks
 * Origin server must support CORS and OPTIONS
 * 
 */
(function($) {
    $(document).ready(function () {
        window.URL = window.URL || window.webkitURL;
        var url = "img/banana.jpg" + "?" + Math.random();

        var outputBlob,
            chunks = 4,
            deferreds = [],
            chunkSizes = 0,
            startByte = 0, 
            endByte = 0,
            progress, done,
            startTime, endTime, currentProgress,
            resultData = [],
            totalLoaded = 0;

        // Progress handler
        progress = function (result) {
                        totalLoaded += result.increment;
                        currentProgress = (totalLoaded/result.total*100/chunks);
                        $('#progressbar-'+result.id).progressbar({value: (result.loaded/result.total*100)});
                        $('#progressspeed-'+result.id).html(result.speed/1000 + " Kb/s");
                        
                        $('#totalprogress').progressbar({value: currentProgress});
                        $('#totalspeed').html(totalLoaded/(1000*(new Date().getTime() - startTime)/1000) + " Kb/s");
                    };
        
        /*
         *  We can't assume these will return in order.
         *  Instead, store resulting data in order based on id
         *  
         */
        
        done = function (result) {
                    resultData[result.id] = result.data;                   
               };
               
        $.when(probeFileSize(url)).then( function (results) {
            chunkSizes = calculateChunkSizes(results.length, chunks);                  
            if (chunkSizes){        
                for(var i=0; i < chunks; i++) {
                    endByte += chunkSizes[i];
                    
                    // If single chunk, set startByte = endByte and download
                    // whole file
                    if (chunks === 1) {
                        startByte = endByte = chunkSizes [i];
                    }
                    
                    deferreds[i] = downloader(url, startByte, endByte, i);
                    startByte = endByte + 1;
                    deferreds[i].progress(progress);
                    deferreds[i].done(done);
                    startTime = new Date().getTime();
                    $('#progressbars').append("<div><h3>Thread " + i + "</h3><div id=\'progressbar-"+ i + "\'></div><span id=\'progressspeed-"+ i + "\'></span></div>");
                }
                
                // Must pass $ to when
                $.when.apply($, deferreds).done( function (result) {
                    outputBlob = new Blob(resultData, {type : 'image/jpeg'});
                    $('#result').html("<img src='" + window.URL.createObjectURL(outputBlob) + "'>");                    
                })
            }
        });
        
        
        /*
         * Get different chunk sizes.
         * Method:
         *      - Test if length divisible by chunks
         *          - If yes, continue
         *          - If no, subtract remainder from number
         *              - Continue
         *              - Add remainder to last chunk
         * Doesn't need to be asynchronous
         */

        function calculateChunkSizes(length, chunks) {
            
            if((typeof(length) != "number" || length === 0) ||
                typeof(chunks) != "number" || chunks === 0)
            {
                return false;
            }
            
            var residue = 0,
                thisLength = 0,
                chunkSizes = [];
            if (length % chunks) {
                residue = (length % chunks);
                length -= residue;
            }
            for (i = 1; i <= chunks; i++) {
                thisLength = length/chunks;
                if (i == chunks) {
                    thisLength += residue;
                }
                chunkSizes.push(thisLength);
            }
            return chunkSizes;        
            
        }

        /*
         * Download a file given a start byte and end byte
         * If the start byte and end byte are the same, assume this is the
         * whole length of the file and don't specify a byte range in the header
         *
         */
        function downloader (url, startByte, endByte, id) {
            var deferred = new $.Deferred(),
                lastLoaded = 0,
                increment = 0,
                startTime = 0,
                endTime = 0,
                duration = 0,
                currentSpeed;
                
            if (window.XMLHttpRequest) {
                var xhr = new XMLHttpRequest();                   
                url = url + "?" + Math.random(); // Prevent caching

                xhr.addEventListener("progress", function (event) {          
                    increment = event.loaded - lastLoaded;
                    lastLoaded = event.loaded;
                    currentSpeed = event.loaded/((new Date().getTime() - startTime)/1000);
                    deferred.notify({"loaded" : event.loaded,
                                     "increment" : increment,
                                     "total" : event.total,
                                     "speed" : currentSpeed,
                                     "id" : id
                                     });
                    }, false);

                xhr.onreadystatechange = function () {
                    if(xhr.readyState == 4) {
                        endTime = new Date().getTime;
                        duration = (endTime - startTime)/1000;
                        
                        // 206 is status for partial download
                        if(xhr.status == 206)
                          {                                 

                            deferred.resolve({
                                "message" : "Success 206",
                                "id" : id,
                                "data" : xhr.response,
                                "duration" : duration
                            });

                          }
                     }   
                }
                xhr.onload = function (){
                    deferred.resolve({
                        "message" : "Success 200",
                        "id" : id,
                        "data" : xhr.response,
                        "endtime" : duration
                    });                  
                }
                xhr.onerror = function (){
                    deferred.reject(
                    {
                        "message" : "Failure",
                        "error" : "Downloading chunk failed"
                    });              
                }        

                xhr.open('GET', url);
                xhr.responseType = 'blob';
                
                // Only specify a range if startByte != endByte
                if (startByte != endByte) {
                    xhr.setRequestHeader("Range", "bytes=" + startByte + "-" + endByte);
                }
                startTime = new Date().getTime();
                xhr.send();                  
            }
            return deferred.promise();
        }

        /*
         * Async operation to check a remote file's size.
         * Requires server to support content-length header.
         * Has some overhead of 10-20k so best suited for larger files. 
         */
        function probeFileSize (url) {

            var length,
                loaded,
                deferred = new $.Deferred();

            if (window.XMLHttpRequest) {
                var xhr = new XMLHttpRequest();
                
                xhr.addEventListener("progress", function (event) {
                   if (event.lengthComputable) {

                       // Get the total length of the file.
                       // Safest way is to wait for event.lengthComputable
                       length = event.total;  
                       loaded = event.loaded;
                       xhr.abort();
                   } 
                });
                
                xhr.onabort = function () {
                    if (typeof(length) === "number" && length > 0) {
                        deferred.resolve(
                        { 
                          "message" : "Success",  
                          "length" : length,
                          "chunks" : chunks
                        });
                    }
                    else {
                        deferred.reject(
                        { 
                            "message" : "Failure",
                            "error" : "Unable to get remote file size"
                        });
                    }
                }
                
                xhr.onload = function (){
                    deferred.reject(
                    { 
                        "message" : "Failure",
                        "error" : "File loaded. This shouldn't have happened."
                    });                    
                }
                xhr.onerror = function (){
                    deferred.reject(
                    { 
                        "message" : "Failure",
                        "error" : "XHR onerror triggered."
                    });                    
                }                
                xhr.open('GET', url);
                xhr.send();             
            }
            return deferred.promise();
        }                    
    });
})(jQuery);