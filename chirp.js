var Chirp = function( opts ){
	var api = {
			user: 'http://api.twitter.com/1/statuses/user_timeline.json?include_entities=true&count={{count}}&include_rts={{retweets}}&exclude_replies={{!replies}}&screen_name={{user}}',
			list: 'http://api.twitter.com/1/{{user}}/lists/{{list}}/statuses.json?include_entities=true',
			search: 'http://search.twitter.com/search.json?include_entities=true&q={{search}}'
		},
		options = {
			retweets: true,
			replies: false,
			user: 'rogie',
			list: null,
			search: null,
			target: null,
			count: 100,
			max: 20,
			cacheExpire: 1000 * 60 * 2, //2 minute expire time
			callback: function(){},
			templates: {
				base:'<ul class="chirp">{{tweets}}</ul>',
				tweet: '<li><img src="{{user.profile_image_url}}"> {{html}}</li>'
			}
		},
		ext = function(o1,o2){
			for(var key in o2){
				if( key in o1 ){
					if( o1[key] && o1[key].constructor == Object ){
						ext(o1[key],o2[key]);
					}else{
						o1[key] = o2[key];
					} 
				}
			} 
		},
		ago = function(time){
			var date = new Date((time || "").replace(/-/g,"/").replace(/[TZ]/g," ")),
				diff = (((new Date()).getTime() - date.getTime()) / 1000),
				day_diff = Math.floor(diff / 86400);
					
			if ( isNaN(day_diff) || day_diff < 0 || day_diff >= 31 )
				return;
					
			return day_diff == 0 && (
					diff < 60 && "just now" ||
					diff < 120 && "1 minute ago" ||
					diff < 3600 && Math.floor( diff / 60 ) + " minutes ago" ||
					diff < 7200 && "1 hour ago" ||
					diff < 86400 && Math.floor( diff / 3600 ) + " hours ago") ||
				day_diff == 1 && "Yesterday" ||
				day_diff < 7 && day_diff + " days ago" ||
				day_diff < 31 && Math.ceil( day_diff / 7 ) + " weeks ago";
		},
		linkify = function( txt ){
			//replace all links
			txt = txt.replace(/((\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|]))/igm,'<a href="$1">$1</a>');
			
			//replace all at-names
			return txt.replace(/@([A-Za-z0-9_]+)/igm,'<a href="http://twitter.com/$1">@$1</a>');	
		},
		toHTML = function( json ){
			var twts = '',i=0; 
			for(twt in json){
				json[twt].index = ++i;
				json[twt].html = linkify(json[twt].text);
				json[twt].time_ago = ago(json[twt].created_at);
				twts += render(options.templates.tweet,json[twt]);
				if( i==options.max ){
					break;
				} 
			}
			return render(options.templates.base,{tweets:twts});
		},
		render = function( tpl, data ){
		   var 	output = tpl,
		       	dotData = function(d,dotKey){
		   	   		try{
		   	   			val = eval("d['" + dotKey.split('.').join("']['") + "']");
		   	   		}catch(e){
		   	   			val = '';
		   	   		}
		   	   		return val;
		   		},
		   		matches = tpl.match(/{{[^}}]*}}/igm);
		   for(i in matches){
		   	output = output.replace(
		   		new RegExp(matches[i],'igm'), 
		   		dotData(data, matches[i].replace(/{{|}}/ig,'')) || ''
		   	);
		   }
		   return output;
		},
		cache = function( key, json ){
			if( localStorage && JSON ){
				var now = new Date().getTime(), 
					cachedData = null;
				//retrieve
				if( json == undefined ){	
					try{ cachedData = JSON.parse(localStorage.getItem(key)); }catch(e){}
					if( cachedData ){
						if( (now - cachedData.time) < options.cacheExpire ){
							cachedData = cachedData.data;
						} else {
							localStorage.removeItem(key);
						}
					}else{
						cachedData = null;
					}
					return cachedData;	
				//set
				}else{	
					try{
						localStorage.setItem(key, escape(JSON.stringify({time:now,data:json})));
					}catch(e){
						console.log(e);
					}
				}	
			}else{
				return null;
			}		
		},
		get = function(){
			Chirp.requests = (Chirp.requests == undefined? 1:Chirp.requests+1);
			var get = document.createElement('script');	
			var	callkey = 'callback' + Chirp.requests,
				kids = document.body.children,
				script = document.scripts[document.scripts.length-1],
				url = (options.list? render(api.list,options) : (options.search? render(api.search,options) : render(api.user,options))),
				scriptInBody = script.parentNode.nodeName != 'head';
				Chirp[callkey] = function(json,cached){
					json = json.results? json.results : json;
					if( cached !== true ){
						cache(url,json);
					}
					var twts = document.createElement('div');
					twts.innerHTML = toHTML(json);
					if( options.target == null ){
						script.parentNode.insertBefore(twts,script);
					}else{
						document.getElementById(options.target).innerHTML = twts.innerHTML;
					}
					options.callback.call(this,json);
				}
			if( cachedData = cache(url) ){
				Chirp[callkey](cachedData,true);
			}else{
				get.src = url + '&callback=Chirp.' + callkey;	
				document.head.appendChild(get);
			}
		},
		init = function( opts ){
			if( opts && opts != undefined ){
				if( opts.constructor == String ){
					var a = opts.split('/'), o = {};
					o.user = a[0];
					o.list = a[1]? a[1] : null;
					ext(options,o);
				}else if (opts.constructor == Object) {
					ext(options,opts);
				}
			}	
		};
	this.show = function( opts ){
		init(opts);
		if( options.target ){
			document.getElementById(options.target).innerHTML = '';
		}
		get();	
	}
	
	//Chirp can be used as a singleton by passing the user to the function	
	if(this.constructor != Chirp ){
		new Chirp( opts ).show();
	}else{
		init( opts );
	}
}
//so that we can read vars
Chirp._script = document.scripts[document.scripts.length-1];