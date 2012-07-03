var Chirp = function( opts ){
	var api = 'http://api.twitter.com/1/statuses/user_timeline.json',
		options = {
			retweets: true,
			replies: false,
			user: 'rogie',
			tweet: null,
			target: null,
			count: 100,
			cacheExpire: 1000 * 60 * 2, //2 minute expire time
			callback: function(){},
			templates: {
				base: '<ul class="chirp">{{tweets}}</ul>',
				tweet: '<li>{{html}}</li>'
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
			}
			return render(options.templates.base,{tweets:twts});
		},
		render = function( tpl, data ){
		   var 	html = tpl,
		       	dotData = function(d,dotKey){
		   	   		return eval("d['" + dotKey.split('.').join("']['") + "']"); 
		   		},
		   		matches = tpl.match(/{{[^}}]*}}/igm);
		   for(i in matches){
		   	html = html.replace(
		   		new RegExp(matches[i],'igm'), 
		   		dotData(data, matches[i].replace(/{{|}}/ig,'')) || ''
		   	);
		   }
		   return html;
		},
		cache = function( key, json ){
			if( localStorage && JSON ){
				var now = new Date().getTime(), 
					cachedData = null;
				//retrieve
				if( json == undefined ){	
					cachedData = JSON.parse(localStorage.getItem(key));
					if( now - cachedData.time < options.cacheExpire ){
						cachedData = cachedData.data;
					}else{
						cachedData = null;
					}
					return cachedData;	
				//set
				}else{		
					localStorage.setItem(key, JSON.stringify({time:now,data:json}));
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
				url = api + '?count=' + options.count + '&include_rts=' + options.retweets + '&exclude_replies=' + !options.replies + '&screen_name=' + options.user,
				scriptInBody = script.parentNode.nodeName != 'head';
				Chirp[callkey] = function(json,cached){
					if( cached !== true ){
						cache(url,json);
					}
					var twts = document.createElement('div');
					twts.innerHTML = toHTML(json);
					if( options.target == null ){
						script.parentNode.insertBefore(twts,script);
					}else{
						document.getElementById(options.target).appendChild(twts);
					}
					options.callback.call(this,json);
				}
			if( cachedData = cache(url) ){
				Chirp[callkey](cachedData,true);
			}else{
				get.src = url + '&callback=Chirp.' + callkey;	
				document.head.appendChild(get);
			}
		};
	this.show = function(){
		get();	
	}
	
	//Chirp can be used as a singleton by passing the user to the function	
	if(this.constructor != Chirp ){
		new Chirp( opts ).show();
	}else{
		if( opts && opts != undefined ){
			if( opts.constructor == String ){
				ext(options,{user:opts});
			}else if (opts.constructor == Object) {
				ext(options,opts);
			}
		}
	}
}
//so that we can read vars
Chirp._script = document.scripts[document.scripts.length-1];