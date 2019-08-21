module.exports = function(RED) {
    'use strict';
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const {
        encode,
        decode
    } = require('./id.js');
    const spawn = require('child_process').spawn;
	const https = require('https');
	https.globalAgent.options.ecdhCurve = 'auto';
    const FTPS = require('ftps');
    const path = require('path');
    const iconv = require('iconv-lite');
    const Parser = require("parse-listing");
    const mime = require('mime-types');
    const fetch = require('node-fetch');
    const JefNode = require('json-easy-filter').JefNode;
    const bufferConcat = require('buffer-concat');
    const { createClient } = require("webdav");

	
	
	
	function sortResults(responseData, prop, asc) {	
			return responseData.items.sort(function(a, b) {
				if (asc) {
					return (a[prop] > b[prop]) ? 1 : ((a[prop] < b[prop]) ? -1 : 0);
				} else {
					return (b[prop] > a[prop]) ? 1 : ((b[prop] < a[prop]) ? -1 : 0);
				}
			});
	
	}


    function fBConfigNode(n) {

        RED.nodes.createNode(this, n);
        this.rules = RED.nodes.getNode(n.rules);
        var node = this;
        this.options = {
            repositoryType: n.repositoryType || "smb",
            share: n.share || 'localhost',
            port: n.port,
            domain: n.domain || '.\\',
            username: n.username,
            password: n.password,
            ftpProtocol: n.ftpProtocol,
            requireSSHKey: n.requireSSHKey,
            sshKeyPath: n.sshKeyPath,
          
        }
    };
    RED.nodes.registerType('filebrowser', fBConfigNode);


    function fileBrowserClient(n) {
	console.log("node-red-contrib-filebrowser initialized.");
	
        RED.nodes.createNode(this, n);
        var node = this;
		



        node.on('input', function(msg) {

	
        let repIx = Number(msg.repIx) - 1;
        this.workdir = n.workdir || '';
        var workdir = this.workdir;
        this.filebrowser = n.rules[repIx].t; 
        this.nodeConfig = RED.nodes.getNode(this.filebrowser);
        let sharePath = this.nodeConfig.options.share.replace(/\/$/, ""); //	// Strip the ending slash
        let username = this.nodeConfig.options.username;
        let password = this.nodeConfig.options.password;
        let domain = this.nodeConfig.options.domain;
        let repositoryType = this.nodeConfig.options.repositoryType;
        let ftpProtocol = this.nodeConfig.options.ftpProtocol;
        let port = this.nodeConfig.options.port;
     



          
            var query = msg.query;
            var remotePath_decoded = '';
			var remotePath_encoded = '';

            let operation = msg.operation;
            let useFulltext = msg.useFulltext;
            let everythingURL = msg.everythingURL.replace(/\/$/, "");;
 

	


            console.log("Rules : " + n.rules);

            if (msg.remotePath && msg.remotePath !== 'XA') {
			
				remotePath_encoded = msg.remotePath;
                remotePath_decoded = decode(msg.remotePath);
            };



            try {

                var parentPath = ""
                var currentDir = ""
				console.log("Remote PAth = " +  remotePath_decoded);
                var folders = remotePath_decoded.split('\\');
                currentDir = folders[folders.length - 1];

                for (var i = 0; i < folders.length - 1; i++) {
                    if (folders[i].trim() !== "") {
                        if (parentPath === "") {
                            parentPath = folders[i];
                        } else {
                            parentPath += "\\" + folders[i];
                        }
                    }
                };
                switch (repositoryType) {
                

				case 'WEBDAV':
                
                if (msg.operation === "xx") {
					
					var agent = require("https").Agent({
					keepAlive: true,
					rejectUnauthorized: false
				
				});

					var wfs = require("webdav-fs")(
						"https://omloaweb300sc.ad.ndr-net.de/TestWebDav/",
						"",
						"",
						agent
					);

					wfs.readdir("/", function(err, contents) {
						if (!err) {
							console.log("Dir contents:", contents);
						} else {
							console.log("Error:", err.message);
						}
					});
				}
				else if (msg.operation === "list"){
					

                    var webDavBaseURL = sharePath;  
					const addOption = {
					'agent': new https.Agent({ rejectUnauthorized: false })
						}
	
                    var webDavClient = createClient(webDavBaseURL, 
                         
                        username,    
                        password,
                        
						addOption
						
                     );
                    
                     console.log("selected folder: " +remotePath_decoded);
                    webDavClient.getDirectoryContents(remotePath_decoded, addOption).then(responseData => {

                        console.log(responseData);   

                        var len = responseData.length;
                    //  console.log("Array len:"+len);
                        var	i;
                        var z = 0;
                        var	newData = { resultCount: responseData.length, items: [] };
                        // get rid of the current directory - otherwise listed in search ...
                        if (query == ""){
                            z = 1;
                        }
                        

                        var standardJSON = {
                            parent: encode(parentPath),
                            currentDir: currentDir,
                            items: []
                        };
                        //Loop through the source JSON and format it into the standard format

                        for (i = z; i < len; i += 1) {

                            let objType;
                            switch (responseData[i].type) {
                                case "file":
                                    objType = "file"
                                    break;
                                case "directory":
                                    objType = "folder"
                                    break;
                                
                            }





                       
                        var id = '';
                        if (remotePath_decoded == '' || remotePath_decoded == null) {
                            id = encode(responseData[i].basename);
                        } else {

                            id = encode(remotePath_decoded + "\\" + responseData[i].basename);
                        }

                        try{
                            let absolutePath = responseData[i].filename;
                            absolutePath = absolutePath.replace("../","");
                            //console.log(absolutePath);
							var encodedURL = encodeURI(webDavBaseURL +  responseData[i].filename);
							var encodedNavURL = encodeURI(webDavBaseURL +  responseData[i].filename);
                            standardJSON.items.push({

                                id: id,
                                name: responseData[i].basename,
                                type:  objType,
                                size: responseData[i].size,
                                filename: responseData[i].basename,
                                lastmod: responseData[i].lastmod,
                                url: encodedURL,
								nav_url : encodedNavURL,
                                mime: responseData[i].mime


                            });
                        }
                            catch(e)
                            {
                            console.log("Error occoured fetching a value from JSON:" + e)
                            }	
                        

                        }
                        msg.data = standardJSON;
                        node.send(msg);
                        
                        




                    })                  
                    .catch(error => console.warn(error));
                    }
                else if (msg.operation === 'find') {

                    var webDavBaseURL = sharePath;  
                    var webDavClient = createClient(webDavBaseURL, 
                        {   
                        username: username,    
                        password: password 
                        }
                     );
                    
                    console.log("selected folder: " +remotePath_decoded);
                    webDavClient.getDirectoryContentsRecursive(remotePath_decoded).then(responseData => {
					//webDavClient.getDirectoryContents(remotePath_decoded).then(responseData => {
						
               //         console.log(responseData);
                    var results = [];
	                var searchField = "basename";
                    var searchVal = query;
                    
                    var	i;
                    var z = 0;
                    var	newData = { resultCount: responseData.length, items: [] };
               
                    var standardJSON = {
                        parent: encode(parentPath),
                        currentDir: currentDir,
                        items: []
                    };
                    

		            for (var i=0 ; i < responseData.length ; i++){
		
			            var regex = new RegExp(query);
			            var matchesRegex = regex.test(responseData[i][searchField]);
			            if (matchesRegex) {
                            console.log("Found")
                  //          results.push(responseData[i]);
                        let objType;
                        switch (responseData[i].type) {
                            case "file":
                                objType = "file"
                                break;
                            case "directory":
                                objType = "folder"
                                break;
                            
                        }
             
                        var id =  encode(responseData[i].filename);
                        

                        try{
                            let absolutePath = responseData[i].filename;
                            absolutePath = absolutePath.replace("../","");
                            //console.log(absolutePath);
							var encodedURL = encodeURI(webDavBaseURL +  responseData[i].filename);
							var encodedNavURL = encodeURI(webDavBaseURL +  responseData[i].filename);
                            standardJSON.items.push({

                                id: id,
                                name: responseData[i].basename,
                                type:  objType,
                                size: responseData[i].size,
                                filename: responseData[i].basename,
                                lastmod: responseData[i].lastmod,
                                url: encodedURL,
								nav_url :  encodedNavURL,
                                mime: responseData[i].mime


                                    });
                                }
                            catch(e)
                            {
                            console.log("Error occoured fetching a value from JSON:" + e)
                            }	
                        

              
         
              

			            }

                    }
                    msg.data = standardJSON;
                    node.send(msg);
                    

                    console.log(results.length);
                    

                        
                    });


                    }
                break;
				
                case 'FTP':

                if (true) { //(msg.operation === "list") {

                            var ftps = new FTPS({
                                host: sharePath,
                                username: username, // Optional. Use empty username for anonymous access.
                                password: password, // Required if username is not empty, except when requiresPassword: false
                                protocol: this.nodeConfig.options.ftpProtocol, // Optional, values : 'ftp', 'sftp', 'ftps', ... default: 'ftp'
                                // protocol is added on beginning of host, ex : sftp://domain.com in this case
                                port: this.nodeConfig.options.port, // Optional
                                // port is added to the end of the host, ex: sftp://domain.com:22 in this case
                                escape: false, // optional, used for escaping shell characters (space, $, etc.), default: true
                                retries: 2, // Optional, defaults to 1 (1 = no retries, 0 = unlimited retries)
                                timeout: 10, // Optional, Time before failing a connection attempt. Defaults to 10
                                retryInterval: 5, // Optional, Time in seconds between attempts. Defaults to 5
                                retryMultiplier: 1, // Optional, Multiplier by which retryInterval is multiplied each time new attempt fails. Defaults to 1
                                requiresPassword: true, // Optional, defaults to true
                                autoConfirm: true, // Optional, is used to auto confirm ssl questions on sftp or fish protocols, defaults to false
                                cwd: '', // Optional, defaults to the directory from where the script is executed
                                additionalLftpCommands: 'set ftp:ssl-allow no;set ssl:verify-certificate no', // Additional commands to pass to lftp, splitted by ';'
                                requireSSHKey: this.nodeConfig.options.requireSSHKey, //  Optional, defaults to false, This option for SFTP Protocol with ssh key authentication
                                sshKeyPath: this.nodeConfig.options.sshKeyPath // Required if requireSSHKey: true , defaults to empty string, This option for SFTP Protocol with ssh key authentication



                            });



                            let lftp_command;

                            ftps.cd("'" + remotePath_decoded + "'");


                            console.log("Query ::" + query)
                            if (query == "") {

                                lftp_command = "ls -lR";
                            } else {
                                lftp_command = "find --ls";
                            }


                            ftps.raw(lftp_command).exec(function(err, result) {
                                // err will be null (to respect async convention) 
                                // res is an hash with { error: stderr || null, data: stdout } 
                                //   console.log("FTP Parameters : " + ftps);
                                console.log("ParentPath: " + parentPath);
                                //      console.log(result.data);




                                var standardJSON = {
                                    parent: encode(parentPath),
                                    currentDir: currentDir,
                                    items: []
                                };


                                //  Parser.parseEntries(result.data, function(err, entryArray) {
                                Parser.parseEntries(result.data, "FTP", function(err, entryArray) {

                                    entryArray.forEach(function(entry, i) {
                                            console.log(i);
                                            standardJSON.resultCount = i;
                                            let objType = entry.type
                                            switch (entry.type) {
                                                case 0:
                                                    objType = "file"
                                                    break;
                                                case 1:
                                                    objType = "folder"
                                                    break;
                                                case 2:
                                                    objType = "file"
                                                    break;
                                            }

                                            //		let parentDir = userPath.substr(0, userPath.lastIndexOf("\\")); // + "\\" + entry.name;

                                            var id = '';
                                            if (remotePath_decoded == '' ||remotePath_decoded == null) {
                                                id = encode(entry.name);
                                            } else {
                                                id = encode(remotePath_decoded + "\\" + entry.name);
                                            }

                                            let openurl;
                                            if (repositoryType == "FTP") {
                                                openurl = ftpProtocol + "://" + sharePath + ":" + port + "\/" + remotePath_decoded + "\\" + entry.name
                                            }
											
											
											var encodedURL = openurl.replace(/\\/g,"/"); // replace all backslashes with forward slashes.
											//var encodedURL = encodeURI(openurl);
										//	var encodedNavURL = encodeURI(openurl);
                                            standardJSON.items.push({
                                                id: id,
                                                name: entry.name,
                                                type: objType,
                                                size: entry.size,
                                                filename: entry.name,
                                                lastmod: entry.time,
                                                url: encodedURL,
												nav_url : encodedURL,
                                                mime: mime.lookup(entry.name)

                                            })


                                        }



                                    );
                                });
                                var filteredJSON = {
                                    parent: encode(parentPath),
                                    currentDir: currentDir,
                                    items: []
                                };

                                standardJSON.items.forEach(function(element, index) {
                                    console.log("Index" + index)
                                    if (element['filename'].search(query) >= 0) {
                                        filteredJSON.items.push(element);
                                        console.log('found', element)

                                    }
                                })
                                //   console.log(filteredJSON);

                                msg.data = filteredJSON;
							
                                node.send(msg);




                            });

                        }
				break;
                    
				case 'SMB':
                   //     if (msg.operation === "list") {
					if (true) {

                              console.log(

                                "Share :		" + sharePath + "\r\n" +
                                "Remote Path :	" + remotePath_decoded + "\r\n" +
                                "Operation :	" + operation + "\r\n" +
                                "User : " + username + "\r\n" + "\r\n" +
                                "Domain : " + domain + "\r\n" +
                                "Username : " + username + "\r\n" +
                                "FulltextSearch URL : " + everythingURL + "\r\n" +
                                "UseFulltextSearch  :" + useFulltext

                            );
                            //WHERE /r  \\orion\users\mdalkaya\Testfolder *Car* /t

                            var parentPath = ""
                            var currentDir = ""
                            var folders = remotePath_decoded.split('\\');
                            currentDir = folders[folders.length - 1];

                            for (var i = 0; i < folders.length - 1; i++) {
                                if (folders[i].trim() !== "") {
                                    if (parentPath === "") {
                                        parentPath = folders[i];
                                    } else {
                                        parentPath += "\\" + folders[i];
                                    }
                                }
                            };

                         
                         
								// if sharePath = \\Server1\OMShare
								let formatedSharePath = sharePath.substring(2); //remove first two backslahes -> Server1\OMShare
								formatedSharePath = formatedSharePath.replace(/\\/g,"/"); // replace all backslashes with forward slashes. Finally our search engine URL becomes: Server1/OMShare
								
								let sortOrder = "0";
								sortOrder = msg.payload.sortOrder=="asc" ? "1" : "0";
								let sortType = "name";
								sortType = msg.payload.orderBy;
						
						
								var searchPath = "";
								//searchPath = sharePath.substring(1) + "\\" + remotePath_decoded.substring(1).replace(/\//g, "\\"); // use path in Format \share\sub1\sub2\ for the everything search engine
								searchPath = remotePath_decoded.substring(1).replace(/\//g, "\\"); // use path in Format \share\sub1\sub2\ for the everything search engine
								var fetchURL
								  if (msg.operation === "list") {
										
									if (remotePath_decoded.includes(formatedSharePath)) {
										fetchURL = everythingURL + "/%5C%5C" + remotePath_decoded.slice(2) + "/?j=1" + "&sort=" + sortType + "&ascending=" + sortOrder
									} else {
										fetchURL = everythingURL + "/%5C%5C" + formatedSharePath + remotePath_decoded + "/?j=1" + "&sort=" + sortType + "&ascending=" + sortOrder
									}
									
								}
								else if (msg.operation === "find") {
								console.log("Remote Path = " + remotePath_decoded)
								fetchURL = everythingURL + "/?search=" + searchPath + "+" + query + "&offset=0&sort="+sortType+"&ascending="+sortOrder+"&json=1&path_column=1&size_column=1&date_modified_column=1";
							
								}
                                console.log("FETCH URL = " + fetchURL);

                                fetch(fetchURL)
                                    .then(response => response.json())
                                    .then(responseData => {

									console.log(responseData);

                                        var len = responseData.results.length;
                                        var standardJSON = {
                                            items: []
                                        };
                                

                                        for (var i = 0; i < len; i += 1) {
                                           
										   try {
											
											var id;
											var http_link
											if (responseData.results[i].hasOwnProperty("path")) { // Output is a search result
											id = encode(responseData.results[i].path +  "\\" + responseData.results[i].name);
											http_link = everythingURL + "/%5C%5C" + responseData.results[i].path.substring(2).replace(/\\/g,"/") + "/" + responseData.results[i].name
											}
											else {
											id = encode(remotePath_decoded + "/" + responseData.results[i].name);
											http_link = everythingURL + "/%5C%5C" + formatedSharePath + remotePath_decoded + "/" + responseData.results[i].name
											}
										
											
											var dateMod = new Date ( responseData.results[i].date_modified / 10000 - 11644473600000 ); // Windows File Time to DateTime
											
											var encodedURL;
												
											//		openurl = everythingURL + "\/" + sharePath + "\\" + remotePath + "\\" + entry.name
											//		encodedURL = encodeURI(openurl);
											
											//		openurl = sharePath + "\\" + remotePath + "\\" + entry.name
												
											
											var uncPath;
											uncPath = sharePath +  remotePath_decoded.replace(/\//g,"\\") + "\\" + responseData.results[i].name,	//replace all forward slahes with backslash 	
											
								//			var encodedNavURL = encodeURI(nav_url);
				
                                                standardJSON.items.push({
                                                    id: id,
                                                    name: responseData.results[i].name,
                                                    type: responseData.results[i].type,
                                                    size: responseData.results[i].size || "",
                                                    filename: responseData.results[i].name,
                                                    lastmod: dateMod, //lastmodDT, //since return is tick,
													url: http_link,
													nav_url : http_link,
													uncPath : uncPath, 
													httpLink : http_link,	
                                                    mime: mime.lookup(responseData.results[i].name)
                                             

                                                });




                                            } catch (e) {
                                                console.log("Error occoured fetching a value from JSON:" + e)
                                            }


                                        }
                                        msg.data = standardJSON;
                                        node.send(msg);
                                    })
                                    .catch(error => console.warn(error));
                       
                        } 

                        break;
                };
            } catch (ex) {
                console.log(ex);
            }

        })
    }

    RED.nodes.registerType('filebrowser in', fileBrowserClient);
};