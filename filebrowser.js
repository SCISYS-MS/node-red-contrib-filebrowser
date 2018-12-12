module.exports = function(RED) {
    'use strict';

    const {
        encode,
        decode
    } = require('./id.js');
    const spawn = require('child_process').spawn;
    const FTPS = require('./lftpwrapper.js');
    const path = require('path');
    const iconv = require('iconv-lite');
    const Parser = require("parse-listing");
    const mime = require('mime-types');
    const fetch = require('node-fetch');
    const JefNode = require('json-easy-filter').JefNode;
    const bufferConcat = require('buffer-concat');




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
            addFulltextUrlPrefix: n.addFulltextUrlPrefix

        }
    };
    RED.nodes.registerType('filebrowser', fBConfigNode);


    function fileBrowserClient(n) {

        RED.nodes.createNode(this, n);
        var node = this;


        node.on('input', function(msg) {

            let repIx = Number(msg.repIx) - 1;
            this.filebrowser = n.rules[repIx].t; 
            this.nodeConfig = RED.nodes.getNode(this.filebrowser);



            this.workdir = n.workdir || '';

            var workdir = this.workdir;
            var query = msg.query;
            var remotePath = '';

            let operation = msg.operation;
            let useFulltext = msg.useFulltext;
            let fulltextEngineURL = msg.fulltextEngineURL
            let sharePath = this.nodeConfig.options.share;
            let username = this.nodeConfig.options.username;
            let password = this.nodeConfig.options.password;
            let domain = this.nodeConfig.options.domain;
            let repositoryType = this.nodeConfig.options.repositoryType;
            let ftpProtocol = this.nodeConfig.options.ftpProtocol;
            let port = this.nodeConfig.options.port;
            let addFulltextUrlPrefix = this.nodeConfig.options.addFulltextUrlPrefix;


            console.log("Rules : " + n.rules);

            if (msg.remotePath && msg.remotePath !== 'XA') {
                remotePath = decode(msg.remotePath);
            };



            try {

                var parentPath = ""
                var currentDir = ""
                var folders = remotePath.split('\\');
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

                            ftps.cd("'" + remotePath + "'");


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
                                            if (remotePath === '') {
                                                id = encode(entry.name);
                                            } else {
                                                id = encode(remotePath + "\\" + entry.name);
                                            }

                                            let openurl;
                                            if (repositoryType == "FTP") {
                                                openurl = ftpProtocol + "://" + sharePath + ":" + port + "\/" + remotePath + "\\" + entry.name
                                            }

                                            standardJSON.items.push({
                                                id: id,
                                                name: entry.name,
                                                type: objType,
                                                size: entry.size,
                                                filename: entry.name,
                                                lastmod: entry.time,
                                                url: openurl,
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
                                  
                                    if (element['filename'].search(query) >= 0) {
                                        filteredJSON.items.push(element);
                                      

                                    }
                                })
                             

                                msg.payload = filteredJSON;
                                node.send(msg);




                            });

                        }

                        break;
                    case 'SMB':
                        if (msg.operation === "list") {


                      /*      console.log(
                                "repositoryType: " + repIx + "\r\n" +
                                "Share :		" + sharePath + "\r\n" +
                                "Remote Path :	" + remotePath + "\r\n" +
                                "Operation :	" + operation + "\r\n" +
                                "User : " + username + "\r\n" + "\r\n" +
                                "Domain : " + domain + "\r\n" +
                                "Username : " + username + "\r\n"


                            );*/



                            let spawnoptions = [
                                "/C",
                                "dir.exe",
                                sharePath + "\\" + remotePath

                            ];

                            var cmdExec = spawn('cmd.exe', spawnoptions);



                            var data = ''
                            var error = ''

                            cmdExec.stdout.on('data', function(res) {
                                data += iconv.decode(Buffer.from(res), '437')
                            })
                            cmdExec.stderr.on('data', function(res) {

                                error += res
                            })

                            cmdExec.on('close', function(code) {

                              


                                var standardJSON = {
                                    parent: encode(parentPath),
                                    currentDir: currentDir,
                                    items: []
                                };
                                Parser.parseEntries(data.trim(), "DIR", function(err, entryArray) {

                                    entryArray.forEach(function(entry, i) {

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

                                            var id = '';
                                            if (remotePath === '') {
                                                id = encode(entry.name);
                                            } else {
                                                id = encode(remotePath + "\\" + entry.name);
                                            }

                                            let openurl;
                                            if (addFulltextUrlPrefix) {
                                                openurl = fulltextEngineURL + "\/" + sharePath + "\\" + remotePath + "\\" + entry.name
                                            } else {
                                                openurl = sharePath + "\\" + remotePath + "\\" + entry.name
                                            }



                                            //       let parentDir = userPath.substr(0, userPath.lastIndexOf("\\")); // + "\\" + entry.name;
                                            standardJSON.items.push({
                                                id: id,
                                                name: entry.name,
                                                type: objType,
                                                size: entry.size,
                                                filename: entry.name,
                                                lastmod: entry.time,
                                                url: openurl,
                                                mime: mime.lookup(entry.name)
                                                //			raw: entry

                                            });


                                        }



                                    );
                                });




                                msg.payload = standardJSON;
                                node.send(msg);

                                //	});

                            });
                        } else if (msg.operation === 'find') {
                       /*     console.log(

                                "Share :		" + sharePath + "\r\n" +
                                "Remote Path :	" + remotePath + "\r\n" +
                                "Operation :	" + operation + "\r\n" +
                                "User : " + username + "\r\n" + "\r\n" +
                                "Domain : " + domain + "\r\n" +
                                "Username : " + username + "\r\n" +
                                "FulltextSearch URL : " + fulltextEngineURL + "\r\n" +
                                "UseFulltextSearch  :" + useFulltext

                            );*/
                            //WHERE /r  \\orion\users\mdalkaya\Testfolder *Car* /t

                            var parentPath = ""
                            var currentDir = ""
                            var folders = remotePath.split('\\');
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

                            if (useFulltext === "true") {
                                console.log("Using fulltext engine");
                                var searchPath = sharePath.substring(1) + "\\" + remotePath // use path in Format \share\sub1\sub2\ for the everything search engine


                                var fetchURL = fulltextEngineURL + "/?search=" + searchPath + "+" + query + "&path=1&offset=0&sort=size&ascending=0&json=1&path_column=1&size_column=1&date_modified_column=1";
                                console.log("FETCH URL = " + fetchURL);

                                fetch(fetchURL)
                                    .then(response => response.json())
                                    .then(responseData => {



                                        var len = responseData.results.length;




                                        var standardJSON = {
                                            items: []
                                        };
                                        var i;


                                        //Loop through the source JSON and format it into the standard format
                                        for (i = 0; i < len; i += 1) {
                                            try {

                                                var id = '';
                                                id = encode(responseData.results[i].path + "\\" + responseData.results[i].name);
                                                let openurl;
                                                if (addFulltextUrlPrefix) {
                                                    openurl = fulltextEngineURL + "\/" + responseData.results[i].path + "\\" + responseData.results[i].name
                                                } else {
                                                    openurl = responseData.results[i].path + "\\" + responseData.results[i].name
                                                }



                                                standardJSON.items.push({
                                                    id: id,
                                                    name: responseData.results[i].name,
                                                    type: responseData.results[i].type,
                                                    size: responseData.results[i].size,
                                                    filename: responseData.results[i].name,
                                                    lastmod: "", //lastmodDT, //since return is tick,
                                                    url: openurl,
                                                    mime: mime.lookup(responseData.results[i].name)
                                                    //			raw: entry

                                                });




                                            } catch (e) {
                                                console.log("Error occoured fetching a value from JSON:" + e)
                                            }


                                        }
                                        msg.payload = standardJSON;
                                        node.send(msg);
                                    })
                                    .catch(error => console.warn(error));
                            } else {
                                //console.log("Execute Search : " + "WHERE /r " +  sharePath + "\\" + remotePath + " " +  "*" + query + "*" + " /t")				
                                let spawnoptions = [
                                    "/r",
                                    sharePath + "\\" + remotePath,
                                    "*" + query + "*",
                                    "/t"
                                ];

                                var cmdExec = spawn('WHERE.exe', spawnoptions);



                                var data = ''
                                var error = ''

                                cmdExec.stdout.on('data', function(res) {
                                    data += iconv.decode(Buffer.from(res), '437')
                                })
                                cmdExec.stderr.on('data', function(res) {

                                    error += res
                                })



                                cmdExec.on('close', function(code) {

                                    console.log(data);


                                    var standardJSON = {
                                        parent: encode(parentPath),
                                        currentDir: currentDir,
                                        items: []
                                    };

                                    Parser.parseEntries(data, "WHERE", function(err, entryArray) {

                                        entryArray.forEach(function(entry, i) {

                                            var id = '';
                                            if (remotePath === '') {
                                                id = encode(entry.name);
                                            } else {
                                                id = encode(remotePath + "\\" + entry.name);
                                            }


                                            let openurl;
                                            if (addFulltextUrlPrefix) {
                                                openurl = fulltextEngineURL + "\/" + sharePath + "\\" + remotePath + "\\" + entry.name
                                            } else {
                                                openurl = sharePath + "\\" + remotePath + "\\" + entry.name
                                            }



                                            //       let parentDir = userPath.substr(0, userPath.lastIndexOf("\\")); // + "\\" + entry.name;
                                            standardJSON.items.push({
                                                id: id,
                                                name: entry.name,
                                                type: entry.type,
                                                size: entry.size,
                                                filename: entry.name,
                                                //   lastmod: entry.time,
                                                url: openurl,
                                                mime: mime.lookup(entry.name)
                                                //			raw: entry

                                            });




                                        });
                                    });

                                    msg.payload = standardJSON;
                                    node.send(msg);
                                })

                            }

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