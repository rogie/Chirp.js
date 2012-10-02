var Chirp = function (opts) {
  var api;
  var options;

  api = {
    user: 'http://api.twitter.com/1/statuses/user_timeline.json?include_entities=true&count={{count}}&include_rts={{retweets}}&exclude_replies={{!replies}}&screen_name={{user}}',
    list: 'http://api.twitter.com/1/{{user}}/lists/{{list}}/statuses.json?include_entities=true',
    search: 'http://search.twitter.com/search.json?include_entities=true&q={{search}}'
  };

  options = {
    retweets: true,
    replies: false,
    user: 'rogie',
    list: null,
    search: null,
    target: null,
    count: 100,
    max: 20,
    cacheExpire: 1000 * 60 * 2,
    success: function () {},
    error: function () {},
    templates: {
      base: '<div class="chirp">{{tweets}}</div>',
      tweet: '<p>{{html}}</p><span class="meta"><time><a href="http://twitter.com/{{user.screen_name}}/statuses/{{id_str}}">{{time_ago}}</a></time> — via <a href="http://twitter.com/{{user.screen_name}}" title="{{user.name}} — {{user.description}}">{{user.name}}</a></span>',
      justNow: 'just now',
      oneMinuteAgo: '1 minute ago',
      minutesAgo: '{{time}} minutes ago',
      oneHourAgo: '1 hour ago',
      hoursAgo: '{{time}} hours ago',
      yesterday: 'Yesterday',
      daysAgo: '{{time}} days ago',
      weeksAgo: '{{time}} weeks ago'
    }
  };

  function render(tpl, data) {
    var output = tpl;
    var matches;
    var i;

    function dotData(d, dotKey) {
      var invert = '';
      var val;
      if (dotKey.indexOf("!") > -1) {
        dotKey = dotKey.replace(/!/ig, '');
        invert = '!';
      }
      try {
        val = eval(invert + "d['" + dotKey.split('.').join("']['") + "']");
      } catch (e) {
        val = '';
      }

      return val;
    }

    matches = tpl.match(/\{\{[^\}\}]*\}\}/igm);

    for (i = 0; i < matches.length; ++i) {
      var m = matches[i];
      var val;
      val = dotData(data, matches[i].replace(/\{\{|\}\}/ig, '')) || '';
      output = output.replace(new RegExp(m, 'igm'), val);
    }

    return output;
  }

  function ext(o1, o2) {
    var key;
    for (key in o2) {
      if (o1.hasOwnProperty(key)) {
        if (o1[key] && o1[key].constructor === Object) {
          ext(o1[key], o2[key]);
        } else {
          o1[key] = o2[key];
        }
      }
    }
  }

  function ago(time) {
    var date;
    var diff;
    var day_diff;

    date = new Date((time || "").replace(/(\d{1,2}[:]\d{2}[:]\d{2}) (.*)/, '$2 $1').replace(/(\+\S+) (.*)/, '$2 $1').replace(/-/g, "/"));
    diff = (((new Date()).getTime() - date.getTime()) / 1000);
    day_diff = Math.floor(diff / 86400);

    if (isNaN(day_diff) || day_diff < 0 || day_diff >= 31) {
      return;
    }

    return day_diff === 0 && (
      diff < 60 && render(options.templates.justNow) ||
      diff < 120 && render(options.templates.oneMinuteAgo) ||
      diff < 3600 && render(
          options.templates.minutesAgo,
          {
            time: Math.floor(diff / 60)
          }
        ) ||
      diff < 7200 && render(options.templates.oneHourAgo) ||
      diff < 86400 && render(
          options.templates.hoursAgo,
          {
            time: Math.floor(diff / 3600)
          }
        )
    ) ||
      day_diff === 1 && render(options.templates.yesterday) ||
      day_diff < 7 && render(
        options.templates.daysAgo,
        {
          time: day_diff
        }
      ) ||
      day_diff < 31 && render(
        options.templates.weeksAgo,
        {
          time: Math.ceil(day_diff / 7)
        }
      );
  }

  function htmlify(txt, entities) {
    var indices = [];
    var key;
    var i;
    var e;
    var html;
    var link;

    html = txt;
    link = {
      'urls': function (e) {
        return '<a href="' + e.expanded_url + '">' + e.display_url + '</a>';
      },
      'hashtags': function (e) {
        return '<a href="http://twitter.com/search/%23' + e.text + '">#' + e.text + '</a>';
      },
      'user_mentions': function (e) {
        return '<a href="http://twitter.com/' + e.screen_name + '" title="' + e.name + '">@' + e.screen_name + '</a>';
      },
      'media': function (e) {
        return '<a href="' + e.expanded_url + '">' + e.display_url + '</a>';
      }
    };
    if (entities) {
      for (key in entities) {
        e = entities[key];
        if (entities[key].length > 0) {
          for (i = 0, e; e = entities[key][i]; ++i) {
            indices[e.indices[0]] = {
              start: e.indices[0],
              end: e.indices[1],
              link: link[key](e)
            };
          }
        }
      }
    }

    for (i = indices.length - 1; i >= 0; --i) {
      if (indices[i] !== undefined) {
        html = html.substr(0, indices[i].start) + indices[i].link + html.substr(indices[i].end, html.length - 1);
      }
    }
    return html;
  }

  function toHTML(json) {
    var twts = '';
    var i;
    var twt;

    i = 0;

    for (twt in json) {
      json[twt].index = ++i;
      json[twt].html = htmlify(json[twt].text, json[twt].entities);
      json[twt].time_ago = ago(json[twt].created_at);
      twts += render(options.templates.tweet, json[twt]);
      if (i === options.max) {
        break;
      }
    }

    return render(options.templates.base, {tweets: twts});
  }

  function cache(key, json) {
    var localStorage;
    if (localStorage && JSON) {
      var now;
      var cachedData;
      now = new Date().getTime();
      cachedData = null;
      if (json === undefined) {
        try {
          var unescape;
          cachedData = JSON.parse(unescape(localStorage.getItem(key)));
        } catch (e) {}
        if (cachedData) {
          if ((now - cachedData.time) < options.cacheExpire) {
            cachedData = cachedData.data;
          } else {
            localStorage.removeItem(key);
            cachedData = null;
          }
        } else {
          cachedData = null;
        }
        return cachedData;
      } else {
        try {
          var escape;
          localStorage.setItem(key, escape(JSON.stringify({time: now, data: json})));
        } catch (e) {
          var console;
          console.log(e);
        }
      }
    } else {
      return null;
    }
  }

  function load() {
    var get;
    var callkey;
    var script;
    var kids;
    var url;
    var scriptInBody;
    var cachedData;

    Chirp.requests = (Chirp.requests === undefined ? 1 : Chirp.requests + 1);
    get = document.createElement('script');
    callkey = 'callback' + Chirp.requests;
    kids = document.body.children;
    script = document.scripts[document.scripts.length - 1];
    url = (options.list ? render(api.list, options) : (options.search ? render(api.search, options) : render(api.user, options)));
    scriptInBody = script.parentNode.nodeName !== 'head';
    Chirp[callkey] = function (json, cached) {
      json = json.results || json;
      if (cached !== true) {
        cache(url, json);
      }
      var twts = document.createElement('div');
      twts.innerHTML = toHTML(json);
      if (options.target === null) {
        script.parentNode.insertBefore(twts, script);
      } else {
        document.getElementById(options.target).innerHTML = twts.innerHTML;
      }
      options.success.call(this, json);
    };
    get.onerror = options.error;
    cachedData = cache(url);
    if (cachedData) {
      Chirp[callkey](cachedData, true);
    } else {
      get.src = url + '&callback=Chirp.' + callkey;
      document.getElementsByTagName('head')[0].appendChild(get);
    }
  }

  function init(opts) {
    if (opts && opts !== undefined) {
      if (opts.constructor === String) {
        var a = opts.split('/'), o = {};
        o.user = a[0];
        o.list = a[1] || null;
        ext(options, o);
      } else if (opts.constructor === Object) {
        ext(options, opts);
      }
    }
  }

  this.show = function (opts) {
    init(opts);
    if (options.target) {
      document.getElementById(options.target).innerHTML = '';
    }
    load();
  };

  //Chirp can be used as a singleton by passing the user to the function
  if (this.constructor !== Chirp) {
    new Chirp(opts).show();
  } else {
    init(opts);
  }
};

//so that we can read vars
Chirp._script = document.scripts[document.scripts.length - 1];