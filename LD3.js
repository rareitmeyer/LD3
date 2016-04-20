// Visualization of map layer(s), per a layers.csv config file.
//
// This page uses Leaflet for displaying maps, and D3 for turning
// values into styles.
//
// Copyright R. A. Reitmeyer 2016
//


registerHandlebarsFormatters()

function GeoApp(map_div, base_layers, initial_base) {
  if (typeof(map_div) === 'undefined') {
    map_div = 'map_div'
  }
  if (typeof(base_layers) === 'undefined') {
    base_layers = {
      "OpenStreetMap": new L.TileLayer("http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"),
      "CartoDB": new L.TileLayer("http://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}.png")
    }
  }
  if (typeof(initial_base) === 'undefined') {
    initial_base = 'CartoDB'
  }
  this.map_div = map_div
  this.base_layers = base_layers
  this.initial_base = initial_base

  // We'll allow users to pick "extra" (point) layers with the Leaflet layer control.
  // But we have two design forces to contend with:
  // 1) We don't want to have all the layers defined in this page (that would be a
  //    maintenance headache). Rather, we want to have all the layers in an external
  //    CSV or JSON file.
  // 2) To be as reponsive as possible, we want to display this page ASAP. That means
  //    not waiting to load all the data for all the layers (there could be a lot).
  //    We don't even want to wait to load all the names of the layers!
  this.extra_layers = {}  // layer {display name: {url: obj:layer geom_type:point|shape opacity:prop}, map, to be added later

  this.mustache_templates = {} // mustache templaates: {url: text}
  this.csv_files = {} // CSV files, {url: text}

  // Make a map and add a layer-picker
  this.map = new L.Map(this.map_div, {center: [37.5, -122.25], zoom: 9, layers: this.base_layers[this.initial_base]})
  this.scale = L.control.scale().addTo(this.map)  // show a scale

  this.layer_control = L.control.layers(this.base_layers, this.extra_layers)
  this.layer_control.addTo(this.map);

  this.mustache_elements = ['popupMst', 'attributionMst']
  this.csv_elements = ['icon:categoricalMapCsv']
  this.style_elements = ['color', 'fillColor', 'opacity', 'fillOpacity', 'weight']
  this.style_props = ['value', 'property', 'range:low', 'range:high', 'default']

  this.prior_zoom = 0

  this.map.on('zoomstart', this.zoomstart.bind(this))
  this.map.on('zoomend', this.zoomend.bind(this))
  this.map.on("overlayremove", this.removeLegend.bind(this));
  this.map.on("overlayadd", this.fetchLayer.bind(this));
}


GeoApp.prototype.zoomstart = function(evt)
{
  this.prior_zoom = this.map.getZoom()
}

GeoApp.prototype.zoomend = function(evt)
{
  var current_zoom = this.map.getZoom()
  console.log("zoom changed from "+this.prior_zoom+" to "+current_zoom)
  if (this.prior_zoom < current_zoom) {
    // if we zoomed in, turn on label_zoom_N for all N from zoom to current zoom.
    ++this.prior_zoom
    for (; this.prior_zoom <= current_zoom; ++this.prior_zoom) {
      d3.selectAll('.label_zoom_'+this.prior_zoom).style("display", "inline")
      console.log("showing labels at scale "+this.prior_zoom)
    }
  } else {
    // if we zoomed out, turn off label_zoom_N for all N from zoom to current zoom.
    for (; this.prior_zoom > current_zoom; --this.prior_zoom) {
      d3.selectAll('.label_zoom_'+this.prior_zoom).style("display", "none")
      console.log("hiding labels at scale "+this.prior_zoom)
    }

  }
}

GeoApp.prototype.popupTemplateRenderer = function(template)
{
  return function(data, layer) {
    layer.bindPopup(template(data))
  }
}


// Return an array of Markers
GeoApp.prototype.getLabels = function(layer_name, data)
{
  var retval = []

  if (!('label:property' in this.extra_layers[layer_name])) {
    return // nothing to do
  }
  var name_prop = this.extra_layers[layer_name]['label:property']
  var minzoom = 1
  if ('label:minzoom' in this.extra_layers[layer_name]) {
    minzoom = this.extra_layers[layer_name]['label:minzoom']
  }
  var zoom_class = 'label_zoom_'+Math.ceil(minzoom)
  var divclass = 'label_div'
  if ('label:divclass' in this.extra_layers[layer_name]) {
    divclass = this.extra_layers[layer_name]['label:divclass']
  }
  
  var obj = this.extra_layers[layer_name].layer_obj

  var style = ''
  if (this.map.getZoom() < minzoom) {
    style = ' style="display: none"'
  }

  var projection = d3.geo.mercator()
  var path_factory = d3.geo.path().projection(projection)

  for (i in data.features) {
    var feature = data.features[i]
    var centroid = projection.invert(path_factory.centroid(feature))
    var lat = centroid[1]
    var lon = centroid[0]
    if ('intptlat' in feature.properties && 'intptlon' in feature.properties) {
      lat = feature.properties.intptlat
      lon = feature.properties.intptlon
    }
    var text_icon = L.divIcon({className:zoom_class + ' ' +divclass, html:'<p class="'+zoom_class+'"'+style+'>'+feature.properties[name_prop]+'</p>', iconSize:null})
    // NOTE: marker takes lat,lon NOT lon,lat!
    retval.push(L.marker([lat,lon], {icon: text_icon, clickable:false, keyboard: false}))
  }

  return(retval)
}


GeoApp.prototype.constructGetter = function(rule) 
{
  var getter = function(feature) {
    if (typeof(feature) === 'undefined') {
      return(0)
    }
    if (rule['property'] in feature.properties) {
      return feature.properties[rule['property']]
    } else {
      if ('default' in rule) {
        return rule.default
      } else {
        return(0)
      }
    }
  }
  return getter
}


GeoApp.prototype.setStyle = function(obj_name)
{
    // Go through styles looking for D3 scales. If any exist,
    // set the domains.
    for (var i = 0; i < this.style_elements.length; ++i) {
      var style_elem = this.style_elements[i]
      if (style_elem in this.extra_layers[obj_name]) {
        if ('scale' in this.extra_layers[obj_name][style_elem]) {
          this.extra_layers[obj_name][style_elem].scale.domain(
            d3.extent(
              this.extra_layers[obj_name].data.features.map(this.extra_layers[obj_name][style_elem].getter)
            )
          )
        }
      }
    }
    this.extra_layers[obj_name].layer_obj.setStyle((function(feature) {
        var style = {}
        for (var i = 0; i < this.style_elements.length; ++i) {
          var style_elem = this.style_elements[i]
          if (style_elem in this.extra_layers[obj_name]) {
            var st = this.extra_layers[obj_name][style_elem]
            if ('value' in st) {
              // easy, there's a fixed value
              style[style_elem] = st['value']
            } else {
              // use the D3 scale object.
              style[style_elem] = st.scale(st.getter(feature))
            }
          }
        }
        return style
      }).bind(this))

    this.addLegend(obj_name, 5)
}

// Allow swapping out styling on one prop name for styling the
// same way on another. Goal is to make it easy to let a user
// decide what they want to show on a choropleth map. Note that
// if you have a layer that originally has styles on multiple
// properties, and this function is used to make the styles all
// use the same property, then you won't be able to set the
// styles separately after that. Be cautious with assigning multiple
// properties to a single layer.
GeoApp.prototype.changeLayerStyleProp = function(layer_name, cur_propname, new_propname)
{
  var changed = false
  for(var i in this.style_elements) {
    var style_elem = this.style_elements[i]
    if (style_elem in this.extra_layers[layer_name]) {
      if ('property' in this.extra_layers[layer_name][style_elem]) {
        if (cur_propname === this.extra_layers[layer_name][style_elem]['property']) {
          // OK, change the propname, regenerate the getter, and 
          // mark something changed.	 
	  this.extra_layers[layer_name][style_elem]['property'] = new_propname
          this.extra_layers[layer_name][style_elem]['getter'] = this.constructGetter(this.extra_layers[layer_name][style_elem])
          changed = true
        }
      }
    }
  }
  if (changed) {
    // if something's changed, remove and redraw the legend for the layer.
    this.removeLegend({'name': layer_name})
    this.setStyle(layer_name)
    this.addLegend(layer_name)
  }
}

// Lazy load function for getting the data for a map.
GeoApp.prototype.fetchLayer = function(obj)
{
  // as an optimization, don't reload what we've already loaded.
  if (this.extra_layers[obj.name].loaded) {
    // already loaded. Just make the legend, since it would have been
    // removed when the layer was removed.
    this.addLegend(obj.name, 5)
    return
  }

  self = this
  d3.json(this.extra_layers[obj.name].url, make_xhr_closure(function (error, data, props) {
    obj = props['obj']
    if (error) {
      console.log(error)
      throw error
    }

    // save the data
    self.extra_layers[obj.name]['data'] = data

    // Add popup, if there's a popup defined
    options = obj.layer.options
    if ('popupMst' in self.extra_layers[obj.name]) {
      popup_mst_url = self.extra_layers[obj.name]['popupMst']
      if (popup_mst_url !== "") {
        template = Handlebars.compile(self.mustache_templates[popup_mst_url])
        if (template !== "") {
          options['onEachFeature'] = self.popupTemplateRenderer(template)
        }
      }
    }
    obj.layer.options = options

    obj.layer.addData(data)

    self.setStyle(obj.name)

    // last, add the label(s)
    labels_group = L.layerGroup(self.getLabels(obj.name, data))
    labels_group.addTo(self.extra_layers[obj.name].layer_obj)

    // remember what's already done.
    self.extra_layers[obj.name]['loaded'] = true
    }, {'obj': obj}))
}


GeoApp.prototype.locationFromIconAnchor = function (size, iconAnchor)
{
  var location = [8,16]
  if (typeof(iconAnchor) !== 'undefined' && iconAnchor != '') {
    if (iconAnchor == 'top-left' || iconAnchor == 'left-top') {
      location = elementwiseMultiply([0  , 0  ], size)
    } else if (iconAnchor == 'top-center' || iconAnchor == 'center-top') {
      location = elementwiseMultiply([0.5, 0  ], size)
    } else if (iconAnchor == 'top-right' || iconAnchor == 'right-top') {
      location = elementwiseMultiply([1.0, 0  ], size)
    } else if (iconAnchor == 'center-left' || iconAnchor == 'left-center') {
      location = elementwiseMultiply([0  , 0.5], size)
    } else if (iconAnchor == 'center-center' || iconAnchor == 'center') {
      location = elementwiseMultiply([0.5, 0.5], size)
    } else if (iconAnchor == 'center-right' || iconAnchor == 'right-center') {
      location = elementwiseMultiply([1.0, 0.5], size)
    } else if (iconAnchor == 'bottom-left' || iconAnchor == 'left-bottom') {
      location = elementwiseMultiply([0  , 1.0], size)
    } else if (iconAnchor == 'bottom-center' || iconAnchor == 'center-bottom') {
      location = elementwiseMultiply([0.5, 1.0], size)
    } else if (iconAnchor == 'bottom-right' || iconAnchor == 'right-bottom') {
      location = elementwiseMultiply([1.0, 1.0], size)
    } else {
      raise('unknown icon:anchor '+iconAnchor)
    }
  }

  return(location)
}


GeoApp.prototype.iconUrlFactory = function(d, self)
{
  if ('icon:value' in d) {
    return(function(feature) {
      return (d['icon:value'])
    }
    )
  } else if ('icon:categoricalMapCsv' in d) {
    return (function(feature) {
      var categoricalMapCsv = self.csv_files[d['icon:categoricalMapCsv']]
      var iconUrl = 'icons/Unknown.png'
      for (row_idx in categoricalMapCsv) {
        var row = categoricalMapCsv[row_idx]
        var match = true
        for (colname in row) {
          if (colname !== 'icon:value') {
            if (colname in feature.properties) {
              if (feature.properties[colname] !== row[colname]) {
                match = false
              }
            } else {
              match = false
            }
          }
        }
        if (match === true) {
          iconUrl = row['icon:value']
          break
        }
      }  
      return (iconUrl)
    }
    )
  }
  return (function(feature) {
    return('icons/Unknown.png')
  })


}

// Process a row of layer data, d.
GeoApp.prototype.processLayerRecord = function(d)
{
  self = this
  // augment each record
  d.id = d.name.replace(/[^A-Za-z0-9_]/g, '_')
  d.loaded = false

  // trim and eliminate any blanks.
  d = removeBlanks(d)
  
  var options = {}
  if (d['geomType:value'] == 'point') {
    var size = [16, 16]
    var location = this.locationFromIconAnchor(size, d['icon:anchor'])
    console.log('location is'+location.toString())
    
    iconFn = this.iconUrlFactory(d, this)
    options['name'] = d.name
    function pointToLayerFactory(iconFn, size, location) {
      return (function(feat,ll) {
        return L.marker(ll, {
            icon: L.icon({
              iconUrl: iconFn(feat),
              iconSize: size,
              iconAnchor: location
            })
        })
      })
    }
    options['pointToLayer'] = pointToLayerFactory(iconFn, size, location)
  }

  // handle 'properties' column
  if ('properties' in d) {
    d.properties = d.properties.split(' ')
  }


  // load CSV files
  for (i = 0; i < this.csv_elements.length; ++i) {
    var csv_elem = this.csv_elements[i]
    if (csv_elem in d) {
      var url = d[csv_elem]
      if (!(url in this.csv_files)) {
        this.csv_files[url] = []
        d3.csv(url,
          make_xhr_closure(
            function(error, resp, props) {
              if (error) {
                console.log(error)
                throw error
              }
              console.log(resp)
              var url = props['url']
              console.log("loaded csv file for url "+url+" as "+resp)
              for (j in resp) {
                resp[j] = removeBlanks(resp[j])
              }
              self.csv_files[url] = resp
            }, {'url': url})
        )
      }
    }
  }

  // load mustache templates for popups
  for (i = 0; i < this.mustache_elements.length; ++i) {
    var mst_elem = this.mustache_elements[i]
    if (mst_elem in d) {
      var url = d[mst_elem]
      if (!(url in this.mustache_templates)) {
        this.mustache_templates[url] = "TEMPLATE NOT LOADED"
        d3.xhr(url, "text/plain", 
          make_xhr_closure(
            function(error, resp, props) {
              if (error) {
                console.log(error)
                throw error
              }
              console.log(resp)
              var url = props['url']
              console.log("loaded template for url "+url+" as "+resp.response)
              self.mustache_templates[url] = resp.response
            }, {'url': url})
        )
      }
    }
  }
  
  // break out style rules elements
  for (var i = 0; i < this.style_elements.length; ++i) {
    var style_elem = this.style_elements[i]
    var rule = {}
    var found = false
    for (var j = 0; j < this.style_props.length; ++j) {
      var prop = this.style_props[j]
      if (style_elem+":"+prop in d) {
        rule[prop] = d[style_elem+":"+prop]
        found = true
        delete d[style_elem+":"+prop]
      }
    }
    if (found) {
      if (('range:high' in rule) || ('range:high' in rule) || ('property' in rule)) {
        if (('range:high' in rule) && ('range:high' in rule) && ('property' in rule)) {
          rule.scale = d3.scale.linear()
          rule.scale.range([rule['range:low'], rule['range:high']])
          rule.getter = this.constructGetter(rule)
        } else {
          msg = d.name+" rule "+style_elem+" does not have all of prop,range:high,range:low!"
          console.log(msg)
          throw msg;
        }
      } else {
        if (!('value' in rule)) {
          msg = d.name+" rule "+style_elem+" lacks a range and prop, but does not have a value!"
          console.log(msg)
          throw msg;
        }
      }
      d[style_elem] = rule
    }
  }

  d.layer_obj = new L.geoJson(null, options)
  this.extra_layers[d.name] = d
  this.layer_control.addOverlay(this.extra_layers[d.name].layer_obj, d.name);
}

GeoApp.prototype.loadLayers_cb = function(error, data) {
  console.log(this.mustache_elements)
  if (error) {
    console.log(error)
    throw error
  }
  data.forEach(this.processLayerRecord.bind(this))
}

GeoApp.prototype.loadLayers = function(layer_url)
{
  if (typeof(layer_url) === 'undefined') {
    layer_url = 'layers.csv'
  }
  d3.csv(layer_url, this.loadLayers_cb.bind(this))
}

GeoApp.prototype.getStyle = function(layer_name, style_elem, feature)
{
  if (style_elem in this.extra_layers[layer_name]) {
    if ('value' in this.extra_layers[layer_name][style_elem]) {
      return(this.extra_layers[layer_name][style_elem]['value'])
    } else { 
      return(this.extra_layers[layer_name][style_elem].scale(
        this.extra_layers[layer_name][style_elem].getter(feature)
      ))
    }
  } else {
    return(null)
  }
}


// Return the unique legend dimension(s) of the layer, a list
// of properties. If the layer lacks any properties
// for a legend, returns an empty list
GeoApp.prototype.layerShapeDimensions = function(layer_name, preferred_levels)
{
  retval = {}

  // if this is a point layer, skip it.
  if (this.extra_layers[layer_name]['geomType:value'] === 'point') {
    return (retval)
  }

  if (typeof(preferred_levels) == 'undefined' || preferred_levels < 2) {
    preferred_levels = 5
  }
  // get all the properties that vary for this layer
  for (i in this.style_elements) {
    style_elem = this.style_elements[i]
    if (style_elem in this.extra_layers[layer_name]) {
      if ('property' in this.extra_layers[layer_name][style_elem]) {
        property = this.extra_layers[layer_name][style_elem].property
        if (!(property in retval)) {
          retval[property] = {}
        }
        if (!('style_elem' in retval[property])) {
          retval[property]['style_elem'] = []
        }
        retval[property]['style_elem'].push(style_elem)
        domain = this.extra_layers[layer_name][style_elem].scale.domain()
        if (!('domain' in retval[property]) || retval[property].domain.length < domain.length) {
          retval[property]['domain'] = domain
        }
      }
    }
  }

  for (property in retval) {
    l = retval[property].domain.length
    if (l > 2) {
      retval[property]['midpoint'] = retval[property].domain[Math.floor(l/2)]
    } else {
      retval[property]['midpoint'] = (retval[property].domain[0] + retval[property].domain[1]) / 2
      retval[property]['range'] = retval[property].domain[l-1] - retval[property].domain[0]
      var decimals = Math.max(0,Math.floor(3-Math.log10(retval[property]['range'])))
      retval[property]['formatter'] = d3.format('0.'+decimals+'f')
    }
  }
  // now define values for setting the legend label(s)
  for (property in retval) {
    other_props = Object.keys(retval).filter(function(x){return(x!=property)})
    retval[property]['values'] = []
    if (retval[property]['domain'].length == 2) {
      domain = retval[property]['domain']
      for (j = 0; j < preferred_levels; ++j) {
        val = {'properties': {}}
        val['properties'][property] = domain[0]+j/(preferred_levels-1)*(domain[1]-domain[0])
        if ('formatter' in retval[property]) {
          val['formatted_properties'] = {}
          val['formatted_properties'][property] = retval[property]['formatter'](val['properties'][property])
        }
        retval[property]['values'].push(val)
      }
    } else {
      domain = retval[property]['domain']
      for (j in domain) {
        val = {'properties': {}}
        val['properties'][property] = domain[k]
        retval[property]['values'].push(val)
      }
    }
    // add midpoint values for any other dimensions
    for (i in other_props) {
      other = other_props[i]
      for (j in retval[property]['values']) {
        retval[property]['values'][j]['properties'][other] = retval[other]['midpoint']
      }
    }
  }
  return(retval)
}

GeoApp.prototype.makeLegendPropSelectCb = function(layer_name, old_prop, properties)
{
  self = this
  legend_prop_select_cb = function() {
    new_prop = '?'
    new_prop = properties[this.selectedIndex];
    console.log("changing layer '"+layer_name+"' property from '"+old_prop+"' to '"+new_prop+"'")
    self.changeLayerStyleProp(layer_name, old_prop, new_prop)
  }
  return legend_prop_select_cb
}


GeoApp.prototype.addLegendShapeIndicator = function(svg, box_size, layer_name)
{
  // now draw two rectangles side-by-side so we get a boundary between them
  for (i = 0; i < 2; ++i) {
    svg.append("rect")
      .attr("width", box_size).attr("height", box_size)
      .attr("x", i*box_size).attr("y", 0)
      .attr("stroke", (function(d){return this.getStyle(layer_name, "color", d)}).bind(this))
      .attr("stroke-width", (function(d){return this.getStyle(layer_name, "weight", d)}).bind(this))
      .attr("opacity", (function(d){return this.getStyle(layer_name, "fillOpacity", d)}).bind(this))
      .attr("fill", (function(d){return this.getStyle(layer_name, "fillColor", d)}).bind(this))
  }
}


GeoApp.prototype.layerPointDimensions = function(layer_name)
{
  retval = {}
  
  // if this is a shape layer, skip it    
  if (this.extra_layers[layer_name]['geomType:value'] === 'shape') {
    return (retval)
  }

  if ('icon:categoricalMapCsv' in this.extra_layers[layer_name]) {
    // make a shorter alias...
    var csvMap = this.csv_files[this.extra_layers[layer_name]['icon:categoricalMapCsv']]
    for (var i in csvMap) {
      var row = csvMap[i]
      for (var colname in row) {
        if (colname != 'icon:value' && !(colname in retval)) {
          retval[colname] = true
        }
      }
    }
  }

  return (retval)
}


// Add (append) a layer to the legend. We won't be picky about
// ordering; if someone opens and closes layers randomly, we won't be
// finnicky about which layer is "first" in the legend.
//
// A layer in the legend_div is its own div, class="layer_id", with a <p
// class="legend_layer_name"> naming the layer.
//
// If the layer has no dimensions (EG, just one icon for a point
// layer, or just one fillColor/fillOpacity/color/weight for a shape
// layer), the indicator for the layer will be run into the end of the
// paragraph.
//
// If the layer does have some dimensions (multiple icons, or
// multiple fillColor/fillOpacity/etc) driven by data, we'll need
// to make a key with the indicators. A key should be a single 
// property, but in icon layers it's possible to imagine picking
// icons based on more than one property.
//
// Lastly, shape properties can allow picking a different property
// to visualize the data in the same way.
//
// So point layers with dimensions will have a table, with
// class="legend_table", straight from the CSV file: header of the
// non-icon value columns, then the icon.  Each row will be the same
// as the CSV, except perhaps for column- ordering to put the icon
// last. (The order of the other columns is undefined.) The th will be
// class="legend_dimension", and the tds will be "legend_value" and
// "legend_indicator".
//
// Shape layers with dimensions will have a <select
// class="legend_dimension"> with the options, if allowed. If not, a p
// with class="legend_dimension">.  Then a table
// class="legend_table". tds will be "legend_value" and
// "legend_indicator".

GeoApp.prototype.addLegend = function(layer_name)
{
  var box_size = 12

  var layer_id = this.extra_layers[layer_name].id

  // find legend div
  var legend_div = d3.select("#legend_div div."+layer_id)
  if (legend_div.empty()) {
    legend_div = d3.select("#legend_div").append("div").attr("class", layer_id)
  }
  // Add header and remove any prior legend
  legend_div.node().innerHTML = ''

  var legend_name_p = legend_div.append("p")
    .attr("class", "legend_layer_name")
  legend_name_p.text(layer_name)

  var layer_has_dimensions = true
  point_dims = this.layerPointDimensions(layer_name)
  shape_dims = this.layerShapeDimensions(layer_name, 5)
  if (Object.keys(point_dims).length == 0 && Object.keys(shape_dims).length == 0) {
    layer_has_dimensions = false
  }

  if (!layer_has_dimensions) {
    legend_name_p.append("span").attr("class", "legend_indicator_spacer")
    if (this.extra_layers[layer_name]['geomType:value'] == 'point') {
      legend_name_p.append("img").attr("src", this.extra_layers[layer_name]['icon:value'])
    } else {
      var svg = legend_name_p.append("span").append("svg")
        .attr("width", 2*box_size).attr("height", box_size)
      this.addLegendShapeIndicator(svg, box_size, layer_name)
    }
  }
  if (Object.keys(shape_dims).length !== 0) {
    for (prop in shape_dims) {
      if ('properties' in this.extra_layers[layer_name]) {
        var select = legend_div.append("select").attr("class", "legend_dimension")
        properties = this.extra_layers[layer_name].properties
        for (i in properties) {
          var opt = select.append("option").attr("value", properties[i]).text(properties[i])
          if (properties[i] === prop) {
	    opt.attr("selected", "true")
          }
        }
        select.on('change', this.makeLegendPropSelectCb(layer_name, prop, properties))
      } else {
        var p = legend_div.append("p").attr("class", "legend_dimension").text(prop)
      }
      var tr = legend_div.append("table").attr("class", "legend_table")
                 .selectAll("tr")
      tr.data(shape_dims[prop].values)
        .enter()
        .call((function(s) {
          var r = s.append("tr")
          r.append("td")
            .attr("class", "legend_value")
            .text(function(d){if ('formatted_properties' in d) {return(d.formatted_properties[prop]) } else { return(d.properties[prop])}})
          var svg = r.append("td")
            .attr("class", "legend_indicator")
            .append("svg")
          svg.attr("width", 2*box_size).attr("height", box_size)
          this.addLegendShapeIndicator(svg, box_size, layer_name)
	}).bind(this))
    }
  }
  if (Object.keys(point_dims).length !== 0) {
    csvMap = this.csv_files[this.extra_layers[layer_name]['icon:categoricalMapCsv']]
    var table = legend_div.append("table").attr("class", "legend_table")
    th_row = table.append("tr")
    cols = Object.keys(point_dims)
    for (c in cols) {
      colname = cols[c]
      th_row.append("th").attr("class", "legend_dimension").text(colname)
    }
    th_row.append("th").attr("class", "legend_dimension").text("icon")
    for (r in csvMap) {
      row = csvMap[r]
      var tr = table.append("tr")
      for (c in cols) {
        colname = cols[c]
        var td = tr.append("td").attr("class", "legend_value").text(row[colname])
      }
      tr.append("td").attr("class", "legend_indicator").append("img").attr("src", row['icon:value'])
    }
  }
}

// Remove a legend, suitable for calling when a user un-selects a layer
GeoApp.prototype.removeLegend = function(obj)
{
  var layer_name = obj.name
  var layer_id = this.extra_layers[layer_name].id

  console.log("remove legend for layer "+layer_id)
  var legend_div = d3.select("#legend_div div."+layer_id)
  legend_div.remove()
}


