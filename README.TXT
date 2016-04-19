# Overview

LD3 is a pure Javascript tool for visualization of geographic
data in GeoJSON form. It was inspired by the needs of the Open
San Mateo Code for America Brigade.


# Simple Use

This should work out-of-the box with the data in point_sampledata
and shape_sampledata. (Note that if you have Javascript disabled
in your browser, you'll need to enable it.)

And you'll need a (minimal) web server, running in this directory.
Open a command line and change to the directory where LD3.html is.
Then use one of these two recommended choices for a basic web server:

* If you have python3, use the built-in web server:
  python3 -m http.server 8080
* If you have node.js, use npm to install http-server and use http-server:
  http-server

Once you've run one of these commands, point your browser to
http://localhost:8080/LD3.html and you should see a map --- if you're 
online. If you are not online, see the 'Working Offline' section below.

There will be a layer-picker at the top-right, and you can use that
to see your data.

For point-layers, the Maki icons are recommended. Get them from
https://github.com/mapbox/maki.


# Changing Icons (Point Layers Only)

Point data shows discrete points on a map, like the location of a
resturant or school. Basic point layers are shown with icons,
specified as a URL in the "icon:value" column. Icons must be 16x16
pixels, preferably as PNG files.

Optionally, a icon:anchor column can be given to pick the location
of the point relative to the icon. Use 'top-right' to position
the icon so the point is at the top-right corner of the icon. 
Similarly, 'bottom-left' will position the icon so the point is at
the icon's bottom-left. Valid choices for the icon:anchor are

    top-left     top-center     top-right
   center-left     center      center-right
   bottom-left  bottom-center  bottom-right

If there is no icon:anchor column, or it is blank, the icon is
anchored as if bottom-center was given.


# Visualizing Categorical Point Data with Data-Driven Icons

The tool allows a point layer with categorized data to use different
icons for different points, if the "icon:value" column is omitted or
blank, and a "icon:categoricalMapCsv" column is present and filled in.

The icon:categoricalMapCsv column must identify a CSV file with one
column named icon:value, holding a URL to an icon, and one or more
other columns named to match properties in the geojson layer.  If a
property-column is left blank, it is ignored. If all the filled-in
property columns match, the feature will use the icon:value. The
file is processed top-to-bottom.

See the example in point_sampledata/Schools_of_San_Mateo_County.icon_map.csv.


# Altering Visualization (Shape Layers Only)

The tool visualizes geographic shape data with styles defined in the
layers.csv file. There are four controllable settings:

* fillColor, the color of the shape's area
* fillOpacity, the 'solidness' of the shape's area (0=transparent, 1=solid)
* color, the outline color of the shape area where two shapes touch
* weight, the thickness of the line drawn where two shapes touch

Each setting can be controlled statically from the layer.csv file, by
providing a column named <setting>:value with a value, where <setting>
is one of the above four settings. This makes the setting the same for
all shapes.

But it's often more visually interesting to show some numeric aspect
of the data. That's the idea behind choropleth maps. To make a choropleth
or something similar, make columns in the layers.csv file named
<setting>:property, <setting>:range:high and <setting>:range:low.
Provide the property name in the GeoJSON file as the :property setting,
and use :range:low and :range:high to specify the value to use for the
shape with the lowest and highest property value. 

If all four columns (:value, :property, :range:low and :range:high)
are specified and filled in, :value will take precedence.


## Visualization Example

For example, the sample data is of California school districts with
CAASPP test scores from 2015, together with some poverty and per-pupil
spending data.  Suppose you want to color code districts by the
CurrentExpensePerADA field with thw lowest-spending district blue, the
highest spending district red. Make sure these columns exist, with these
values:
* Column fillColor:property exists and has value CurrentExpensePerADA
* Column fillColor:range:low exists and has value blue
* Column fillColor:range:high exists and has value red
* Column fillColor:value does not exist, or is blank.

When a layer has a data-driven visualization, a legend will appear
under the map with the key(s) for the property(ies) visualized by the
layer.

If one property is visualized in multiple ways, the property key only
appears once. EG, suppose CurrentExpensePerADA controls both fillColor
and fillOpacity --- CurrentExpensePerADA will show up once.


# Vizualizing Multiple Properties (Shape Layers Only)

If multiple properties are visualized at the same time, each property
will appear with its key, assuming all the other properties are at their
midpoint value(s). EG, if CurrentExpensePerADA controls color from blue to
red, and Pop_5_17_Poverty_Percent controls opacity from 0.1 to 0.9, then
the key for CurrentExpensePerADA will run from blue to red at opacity
of 0.5, and the key for Pop_5_17_Poverty_Percent will run from opacity
0.1 to 0.9 with color purple.

Tip: Visualizing multiple things at once sounds fun, but in practice it
can be difficult to users to understand. Rather than try to show users
everything at once, or coding up multiple layers that show the same shape
with different formatting, it might be better to let users control the
visualization and toggle back-and-forth as desired. Which leads to...


# User Choice for Visualization (Shape Layers Only)

If a layer has data visualization, it is possible to let users pick
other properties to visualize in the same way. List the other candidates
in the layers.csv file with a column named "properties", separated by
spaces.

Then the legend key(s) will become a picklist of those properties.

This lets users visualize different things without the confusion of
multiple keys on a layer, or requiring one layer for each thing.

For example, the properties column could be list "CurrentExpensePerADA
Pop_5_17_Poverty_Percent TotPop percentage_standard_met_and_above" to
let users replace the default visualization(s) by any of these things.

Known issue: if a layer has multiple visualization properties by default,
the user will be able to change them individually, and could choose to
make them match. Once that happens, the layer will have one fewer distinct
property that it can visualize at the same time.


# Changing Popups

Clicking on a shape will being up a popup with details. The popups are
Handlebars templates of content for an HTML div.  Note that the popup
cannot be very big---content should fit in a div of (at most) 100px
wide by 400px high. Use {{property.<propname>}} to display the
<propname> property from the data for the shape. For example, in the
CAASPP data, the Ca Dept of Eucation name for the school district is
the "caed_name" property, so the popup Handlebars template contains
{{property.caed_name}} to identify the district.

Please refer to Handlebars and/or HTML documentation for details.

* Handlebars at http://handlebarsjs.com/
* w3 HTML5 at https://www.w3.org/TR/html5/


## Numeric Formatters in Handlebars Templates

Numeric data can often benefit from a little cleanup.  If a school
district with 11313 residents aged 5-17 has 1728 of those residents in
poverty, a computer will calculate a Pop_5_17_Poverty_Percent field
with value 15.274463 ... but for purposes of displaying poverty to a
human, most of those decimal places are clutter and should be omitted.
And it's nice to put a % suffix on percentages, and a $ prefix on
figures in dollars, even though the raw data lacks them.

A few formatters are available, for controlling how numbers in the 
data will appear in the popup:

* float0
* float2
* float4
* percentage0
* percentage2
* dollars0
* dollars2

To use a formatter on a value, write the formatter first, separated by a
space. EG, to format CurrentExpensePerADA as dollars with 0 digits after
the decimal point, write {{dollars0 CurrentExpensePerADA}}.


# Changing Labels

Each shape can be labeled, if the map is zoomed in enough. The property
used as a label is specified in the layers.csv file with the label:property
column. The minimum zoom must be provided in the label:minzoom column.

Tip: Picking the minimum zoom is best approached through trial and
error.  For the sample school district data, the first zoom level
where the names do not significantly overlap is ~10, in the author's
opinion.  For something like parks and open space, where some city
parks are just the size of a large residential yard, you'd probably
want a much higher minzoom, or to omit labels altogether.

Known issue: if labels are shown, then the layer is hidden, then the
zoom is changed, then the layer is un-hidden, the label state (shown or
not) is based on the zoom when when the layer was hidden, not the current
zoom.


# Adding Layers

To add a new layer, make or find a GeoJSON file with your data. Add a
row to the layers.csv file with a name for the data (which will appear
in the layer selector) and the URL to retreive the data. The URLs in
the sample layers.csv are local (like sampledata/grade_3_mathematics.geojson),
but online URLs are perfectly fine, if you have one 
(like https://data.smcgov.org/api/geospatial/ca5i-9ks8?method=export&format=GeoJSON).

Make sure there's a "geomType:value" column with the kind of geometry
that the layer contains. Choices are "shape" and "point".

Add or adjust other columns as required, using the notes above.


# Troubleshooting Tips

If something does not look right, open up the Javascript console window
in the browser, reload the page, and see if there are useful messages.


# Working Offline

This tool works best online, because it accesses online base maps
from either CartoDB (http://cartodb.com) and/or Open Street Map
(http://www.openstreetmap.org).

But if you're offline for some reason, you can run offline (sans base maps)
if you download local copies of:
* D3, from Mike Bostock, at http://d3js.org
* Leaflet, from Vladimir Agafonkin, at http://leafletjs.com/index.html
* Handlebars.js from Yehuda Katz, at http://handlebars.com

Unzip leaflet 0.7.7 into this directory, and place a copy of
d3.v3.min.js and handlebars-v4.0.5.js here as well. Then edit LD3.html
to comment out the online versions of these libraries, and uncomment
the local versions.

Again, you won't be able to see the base maps.


# Changes

2016-04-12: 
* renamed geom_type:value column to geomType:value, and made it required.
* added support for point layers with icons
