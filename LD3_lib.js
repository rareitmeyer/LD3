
function registerHandlebarsFormatters() {
  var formatter_float0 = d3.format("0.0f")
  var formatter_float2 = d3.format("0.2f")
  var formatter_float4 = d3.format("0.4f")
  
  // Using handlebars so we can do a little cleanup on things if needed.
  // For example, turning numbers from 0..1 into percentages
  Handlebars.registerHelper('float0', function(number) {
    return formatter_float0(number)
    })
  Handlebars.registerHelper('float2', function(number) {
    return formatter_float2(number)
    })
  Handlebars.registerHelper('float4', function(number) {
    return formatter_float4(number)
    })
  Handlebars.registerHelper('percentage0', function(number) {
    return formatter_float0(number)+'%'
    })
  Handlebars.registerHelper('percentage2', function(number) {
    return formatter_float2(number)+'%'
    })
  Handlebars.registerHelper('dollars0', function(number) {
    return '$'+formatter_float0(number)
    })
  Handlebars.registerHelper('dollars2', function(number) {
    return '$'+formatter_float2(number)
    })
}


function make_xhr_closure(fn, props)
{
  return function(error, resp) {
    return fn(error, resp, props)
  }
}


function elementwiseMultiply(a, b) {
  var stop = Math.min(a.length, b.length)
  var retval = []
  for (var i = 0; i < stop; ++i) {
    retval.push(a[i]*b[i])
  }
  return retval
}


function removeBlanks(d)
{
  for(k in d) {
    if (typeof(d[k]) === 'undefined') {
      delete d[k]
    } else if (typeof(d[k]) === 'string') {
      d[k] = d[k].trim()
      if (d[k] === '') {
        delete d[k]
      }
    }
  }
  return (d)
}


