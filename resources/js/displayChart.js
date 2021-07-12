'use strict';

const MAX_ITERATION_NAME_LENGTH = 40;
const MAX_CARETX_VALUE = 200;
const MAX_DURATION = 480;
const MAX_TOTAL_STEPS = 11520;
const DEFAULT_BUILD_VALUE = "";

const HTTP_METHODS = {
  GET: "GET",
  HEAD: "HEAD",
  POST: "POST",
  PUT: "PUT",
  DELETE: "DELETE",
  TRACE: "TRACE",
  OPTIONS: "OPTIONS",
  CONNECT: "CONNECT"
};

const URLS = {
  default: {
    css: '../resources/css/style.css',
    cssRightSide: '../resources/css/rightside.css',
    level0Chart: '../resources/json/Leve0Chart.json',
    level1Chart: '../resources/json/Level1Chart.json'
  },
  project: {
    config: '',
    css: '',
    level0Chart: '',
    level1Chart: ''
  }
};

Number.prototype.toHHMMSS = function () {
  let d = this;
  let h = Math.floor(d / 3600);
  let m = Math.floor(d % 3600 / 60);
  let s = Math.floor(d % 3600 % 60);
  return ('0' + h).slice(-2) + ":" + ('0' + m).slice(-2) + ":" + ('0' + s).slice(-2);
};

function getFileData(/*String*/url, /*Function*/successCallback, /*String?*/methodType) {
  $.ajax({type: methodType || HTTP_METHODS.GET, url: url, success: successCallback, datatype: "application/json"});
}

function configureURL(/*String*/url, /*Function*/successCallback, /*Function*/errorCallback) {
  $.ajax({type: HTTP_METHODS.HEAD, url: url, success: successCallback, error: errorCallback});
}

function applyCSS(/*Array*/url) {
  if (!url) { return; }

  for (let i = 0; i < url.length; i++) {
    let cssUrl = url[i];
    if (cssUrl) {
      $('head').append('<link rel="stylesheet" media="all" rev="stylesheet" href="' + cssUrl + '"/>');
    }
  }
}

function onLoad() {
  let urlParams = $.parseParams();

  let project = (urlParams && urlParams.project) || null;
  if (!project) {
    $('body').html('<h2 class="error">No project selected</h2>');
    return;
  }

  let projectBase          = '../projects/' + project;
  URLS.project.config      = projectBase + '/config.json';
  URLS.project.level0Chart = projectBase + '/json/Leve0Chart.json';
  URLS.project.level1Chart = projectBase + '/json/Level1Chart.json';
  URLS.project.css         = projectBase + '/css/style.css';

  // var isFullscreen = document.location.ancestorOrigins.length === 0;
  let isFullscreen = window.location === window.parent.location;

  let level = (urlParams && urlParams.level) || "0";
  if (level === "0") {
    $('<div class="ctrl">' +
      (isFullscreen ? '' : '<input type="button" id="fullscreenButton" class="ctrl" value="Full Screen" />') +
      '<input type="button" id="refreshButton" class="ctrl" value="Refresh" />' +
      '</div>').prependTo($("#summaryTable"));
  }
  if (level === "1") {
    $('<div class="ctrl"><input type="button" id="backButton" class="ctrl" value="Back" /></div>')
    .prependTo($("#summaryTable"));
  }

  let index = (urlParams && urlParams.index) || null;

  $(document).on("click", "#refreshButton", function () { window.location.reload(true); });
  $(document).on("click", "#backButton", function () {
    window.location = window.location.href.replace(/&?level=\d+/, '').replace(/&?index=\d+/, '');
  });
  if (!isFullscreen) {
    let dashboardUrl = document.location.href;
    dashboardUrl     = dashboardUrl.replace(/orientation=[\w]+/, '');
    dashboardUrl     = dashboardUrl.replace(/level.+=[\d]+/, '');
    dashboardUrl     = dashboardUrl.replace(/index=[\d]+/, '');
    dashboardUrl     = dashboardUrl.replace(/&&/, '');
    dashboardUrl     = dashboardUrl.replace(/&$/, '');
    $(document).on("click", "#fullscreenButton", function () {
      window.open(dashboardUrl, 'nexial-dashboard-fullscreen');
    });
  }

  let summaryUrl = location.toString().substring(0, location.toString().lastIndexOf('/')) +
                   '/../projects/' + project + '/summary_output.json';
  getFileData(summaryUrl,
    function (summary) {
      let content          = typeof summary === "string" ? JSON.parse(summary) : summary;
      let configURL        = level === "1" ? URLS.project.level1Chart : URLS.project.level0Chart;
      let defaultConfigURL = level === "1" ? URLS.default.level1Chart : URLS.default.level0Chart;
      configureURL(configURL,
        function () {
          getFileData(configURL,
            function (chartConfig) {
              let chartConfigData = typeof chartConfig === "string" ? JSON.parse(chartConfig) : chartConfig;
              displayChartAndTable(chartConfigData, content, level, index);
            });
        },
        function () {
          getFileData(defaultConfigURL,
            function (chartConfig) {
              let chartConfigData = typeof chartConfig === "string" ? JSON.parse(chartConfig) : chartConfig;
              displayChartAndTable(chartConfigData, content, level, index);
            });
        });
    });

  let displayOrientation = (urlParams && urlParams.orientation) || null;
  let moreCss = [];
  if (displayOrientation === 'rightside') { moreCss.push(URLS.default.cssRightSide); }

  configureURL(
    URLS.project.css,
    function () {
      moreCss.push(URLS.project.css);
      applyCSS(moreCss.reverse());
    },
    function () {
      moreCss.push(URLS.default.css);
      applyCSS(moreCss.reverse());
    }
  );
}

function shrinkName(name) {
  return (name.length > MAX_ITERATION_NAME_LENGTH) ? name.substring(0, MAX_ITERATION_NAME_LENGTH - 4) + "..." : name;
}

function displayChartAndTable(/*Object*/chartConfig, summary, /*String*/level, index) {
  if (!level) { level = "0"; }
  if (!index) { index = null; }

  let chartData;
  let results = [];

  let subtitle = '';
  if (level === "0") {
    results = summary.results;
    chartData = parseResult(results, "0");
    subtitle = 'Latest: ' + chartData.labels[chartData.labels.length - 1];
    chartData = calculateExecutionStats(chartData);
    displayExecutionSummaryStats("summarystats_div", chartData);
  } else {
    let executionResult = summary.results[index];
    let key             = Object.keys(executionResult)[0];
    let buildNo         = executionResult[key].plan.referenceData.buildnum == undefined ?
                          DEFAULT_BUILD_VALUE : executionResult[key].plan.referenceData.buildnum;
    let totalScripts    = executionResult[key].scriptResults.length;
    subtitle            = key + "<br>Total Scripts:" + totalScripts +
                          ((buildNo === "") ? "" : "<br>Build:" + buildNo);

    executionResult[key].scriptResults.forEach(function (script) {
      script.nestedExecutions.forEach(function (iteration) {
        results.push({scriptName: script.name, iterations: iteration});
      });
    });
    chartData = parseResult(results, level);
  }

  displayChart('nexial_result_chart', chartData, chartConfig, level);
  displayTable('execution_results', chartData, results, level);
  $('table').tablesorter();
  $('#sectionTitle').append('<span class="lastMod">' + subtitle + '</span>');
}

function parseResult(nexialExecData, /*String*/level) {
  if (!level) { level = "0"; }

  let chartData = {
    labels:              [],
    shrinkedLabels:      [],
    buildNo:             [],
    totalScripts:        [],
    name:                [],
    passCount:           [],
    failCount:           [],
    stepCount:           [],
    successPercent:      [],
    durationInHHMMSS:    [],
    duration:            [],
    downloadLinks:       [],
    executionOutputPath: [],
    totalDuration:       0,
    totalFailCount:      0,
    totalStepCount:      0,
    dateValues:          [],
  };

  if (level === "1") {
    nexialExecData.forEach(function (entry) {
      let result = entry.iterations;
      chartData.labels.push(entry.scriptName);
      chartData.downloadLinks.push(result.testScriptLink);
      chartData = getChartData(result, chartData, entry.scriptName);
    });
  } else {
    nexialExecData.forEach(function (entry) {
      for (let key in entry) {
        chartData.labels.push(key);
        chartData.dateValues.push(key.substring(0, key.lastIndexOf(' ')));
        let result = entry[key].plan ? entry[key].plan : entry[key].scriptResults;
        if (!result) { continue; }

        if (result === entry[key].scriptResults) {
          result.forEach(function (script) { chartData = getChartData(script, chartData); });
        } else {
          let buildNo = (!result.referenceData || !result.referenceData.buildnum) ?
                        DEFAULT_BUILD_VALUE : result.referenceData.buildnum;
          chartData.buildNo.push(buildNo);
          chartData.totalScripts.push(entry[key].scriptResults.length);
          let exeOutputPath = entry[key].scriptResults[0].nestedExecutions[0].testScriptLink;
          exeOutputPath = exeOutputPath.substring(0, exeOutputPath.lastIndexOf('/'));
          chartData.executionOutputPath.push(exeOutputPath);
          chartData = getChartData(result, chartData);
        }
      }
    });
  }

  return chartData;
}

function getChartData(result, chartData, /*String*/scriptName) {
  if (!scriptName) { scriptName = ''; }

  chartData.name.push(scriptName + " / " + result.name);
  chartData.shrinkedLabels.push(shrinkName(scriptName + " / " + result.name));
  chartData.stepCount.push(result.totalSteps);
  chartData.passCount.push(result.passCount);
  chartData.failCount.push(result.failCount);
  chartData.successPercent.push((result.passCount / result.totalSteps * 100).toFixed(2));

  let duration = (result.endTime - result.startTime) / 1000;
  chartData.durationInHHMMSS.push(duration.toHHMMSS());
  chartData.duration.push(duration / 60);
  if ((($.parseParams() && $.parseParams().level) || "0") === "0") {
    chartData.totalFailCount = chartData.totalFailCount + result.failCount;
    chartData.totalDuration = chartData.totalDuration + (duration * 1000);
    chartData.totalStepCount = chartData.totalStepCount + result.totalSteps;
  }
  return chartData;
}

// load line chart when browser window opened
function displayChart(domId, chartData, chartConfig, /*String*/level) {
  let maxCount = Math.max.apply(Math, chartData.stepCount);
  let maxDuration = Math.max.apply(Math, chartData.duration);

  let dimensions = new Dimensions();
  let keyForDuration = getDimensions(maxDuration, dimensions.Y2_AXIS_GRAPH_DIMENSIONS);
  let keyForSteps = getDimensions(maxCount, dimensions.Y1_AXIS_GRAPH_DIMENSIONS);

  let chartOption = chartConfig.chartOptions;

  let yAxis1Tick = chartOption.scales.yAxes[0].ticks;
  yAxis1Tick.max = keyForSteps !== Infinity ? keyForSteps : MAX_TOTAL_STEPS;
  if (yAxis1Tick.max < 100) {
    yAxis1Tick.max = 100;
    yAxis1Tick.stepSize = 10;
  } else {
    yAxis1Tick.stepSize =
      dimensions.Y1_AXIS_GRAPH_DIMENSIONS[keyForSteps !== Infinity ? keyForSteps : MAX_TOTAL_STEPS];
  }

  let yAxis2Tick = chartOption.scales.yAxes[1].ticks;
  yAxis2Tick.max = keyForDuration !== Infinity ? keyForDuration : MAX_DURATION;
  yAxis2Tick.stepSize =
    dimensions.Y2_AXIS_GRAPH_DIMENSIONS[keyForDuration !== Infinity ? keyForDuration : MAX_DURATION];

  // for area and line chart in single canvas
  let legends = {
    datasets: chartConfig.datasets,
    labels:   chartData.labels
  };

  legends.datasets[0].data = chartData.successPercent;
  legends.datasets[1].data = chartData.failCount;
  legends.datasets[2].data = chartData.passCount;
  legends.datasets[3].data = chartData.stepCount;
  legends.datasets[4].data = chartData.duration;

  let chartType;
  if (level === "0") {
    chartType = 'line';
    chartOption.onClick = function (c, i) {
      window.open(window.location.href + '&level=1&index=' + i[0].index, '_self');
    };
  } else {
    chartType = 'bar';
    legends.labels = chartData.name;
    legends.labels = chartData.shrinkedLabels;

    // chartOption.option
    chartOption.onClick = function (c, i) {
      window.open(chartData.downloadLinks[i[0]._index], '_blank');
    };
  }

  document.getElementById("sectionTitle").innerHTML = chartOption.title.text;

  chartOption.tooltips = {
    "mode":              "index",
    "position":          "nearest",
    "titleMarginBottom": 12,
    "bodyFontColor":     "#dddddd",
    "bodySpacing":       6,
    "xPadding":          8,
    "borderWidth":       2,
    "enabled":           false,
    "custom":            customTooltips
  };

  return new Chart($('#' + domId).get(0).getContext('2d'), {
    type:    chartType,
    data:    legends,
    options: chartOption
  });
}

function Dimensions() {
  this.Y1_AXIS_GRAPH_DIMENSIONS = {
    1:    0.1,
    2:    0.1,
    3:    0.2,
    5:    0.5,
    7:    0.5,
    10:   1,
    20:   1,
    45:   5,
    90:   10,
    150:  10,
    180:  10,
    250:  10,
    360:  20,
    450:  20,
    600:  30,
    720:  40,
    900:  40,
    1200: 60,
    1440: 80,
    2000: 100,
    2500: 120,
    2880: 160,
    5760: 320
  };

  this.Y2_AXIS_GRAPH_DIMENSIONS = {
    1:   0.1,
    2:   0.2,
    3:   0.2,
    5:   0.5,
    7:   0.5,
    10:  1,
    15:  1,
    20:  1,
    30:  1,
    45:  5,
    60:  5,
    80:  10,
    90:  10,
    180: 10,
    250: 10,
    300: 20,
    360: 20
  };

  this.Y1_AXIS_GRAPH_DIMENSIONS[MAX_TOTAL_STEPS] = 640;
  this.Y2_AXIS_GRAPH_DIMENSIONS[MAX_DURATION]    = 30;
}

function getDimensions(dimension, DURATION_DIMENSIONS) {
  let keys = Object.keys(DURATION_DIMENSIONS);
  return Math.min.apply(Math, keys.filter(function (value) {return value >= dimension; }));
}

let customTooltips = function (tooltip) {
  // Tooltip Element
  let tooltipEl = document.getElementById('chartjs-tooltip');
  if (!tooltipEl) {
    tooltipEl           = document.createElement('div');
    tooltipEl.id        = 'chartjs-tooltip';
    tooltipEl.innerHTML = '<table class="tooltip-table" cellpadding="1" cellspacing="0"></table>';
    this._chart.canvas.parentNode.appendChild(tooltipEl);
  }

  // Hide if no tooltip
  if (tooltip.opacity === 0) {
    tooltipEl.style.opacity = 0;
    return;
  }

  // Set caret Position
  tooltipEl.classList.remove('above', 'below', 'no-transform');
  tooltipEl.classList.add(tooltip.yAlign ? tooltip.yAlign : 'no-transform');

  function getBody(bodyItem) { return bodyItem.lines; }

  // Set Text
  if (tooltip.body) {
    console.log("tooltip.body = " + tooltip.body);
    let innerHtml = '<thead>';
    (tooltip.title || []).forEach(function (title) {
      innerHtml += '<tr><th colspan="2" style="word-break:break-all">' + title + '</th></tr>';
    });
    innerHtml += '</thead>';

    innerHtml += '<tbody>';
    tooltip.body.map(getBody).forEach(function (body, i) {
      console.log("body = " + body);
      console.log("i = " + i);
      let colors = tooltip.labelColors[i];
      let style  = 'background:' + colors.backgroundColor + ';' +
                   'border-color:' + colors.borderColor + ';' +
                   'border-width:2px';
      let span   = '<span class="chartjs-tooltip-key" style="' + style + '"></span>';

      innerHtml += '<tr>';
      let bodyContents = body.toString().split(":");
      if (i === 4) {
        innerHtml += '<td class="tooltip-label">' + span + 'duration</td>' +
                     '<td>' + (Number(bodyContents[1].trim()) * 60).toHHMMSS() + '</td>';
      } else {
        innerHtml += '<td class="tooltip-label">' + span + bodyContents[0] + '</td>' +
                     '<td>' + bodyContents[1] + '</td>';
      }
      innerHtml += '</tr>';
    });
    innerHtml += '</tbody>';

    tooltipEl.querySelector('table').innerHTML = innerHtml;
  }

  let positionY = this._chart.canvas.offsetTop;
  let positionX = this._chart.canvas.offsetLeft;

  // Display, position, and set styles for font
  tooltipEl.style.opacity = 1;

  /*Logic for Tooltip positioning. If the coordinate(point on the graph) of the graph is towards the right of the
   chart then the tooltip is displayed towards the left side of the coordinate(point on the graph).
   By default it displays towards right. The below logic specifies whether the tooltip to be displayed right or left.*/

  let chartWidth          = document.getElementById("nexial_result_chart_canvas").clientWidth;
  tooltipEl.style.left    = positionX +
                            ((chartWidth - tooltip.caretX < MAX_CARETX_VALUE) ? tooltip.caretX - MAX_CARETX_VALUE :
                             tooltip.caretX) + 'px';
  tooltipEl.style.top     = positionY + tooltip.caretY + 'px';
  tooltipEl.style.padding = tooltip.yPadding + 'px ' + tooltip.xPadding + 'px';
};

function createThElement(htmlText, idAttributeValue, classAttributeValue, insertAfterElement) {
  let th = document.createElement("th");
  th.setAttribute("id", idAttributeValue);
  th.setAttribute("class", classAttributeValue);
  $(th).insertAfter(insertAfterElement);
  $("#" + idAttributeValue).html(htmlText);
}

// load table data when browser window opened
function displayTable(/*String*/tableId, /*JSONObject*/chartData, summary, /*String*/level) {
  let table     = $('#' + tableId);
  let tableBody = $("#tableBody");
  let rowIndex  = 0;

  // Replacing the dateTime heading with iteration.
  if (level === "1") {
    $('#dateTime').html("iteration");
  } else {
    createThElement("build", "buildNo", "sort-by", "#dateTime");
    createThElement("total scripts", "totalScripts", "sort-by", "#dateTime");
  }

  tableBody.append(
    $.map(summary, function (result, index) {
      let linkColumn          = '';
      let buildNoRow          = '';
      let totalScriptRow      = '';
      let dateTimeRowContent  = '<td nowrap="true" class="dateTime">' + chartData.labels[index] + '</td>';
      let executionOutputLink = '';
        if (level === "0") {
          linkColumn          = '<a href="' + window.location.href + '&level=1&index=' + rowIndex +
                                '" target="_self" class="drilldownlink" title="drill down">&nbsp;&nbsp;&nbsp;&nbsp;</a>';
          executionOutputLink = '<a href="' + chartData.executionOutputPath[index] + '/execution-output.html' +
                                '" target="summarystats"  class="exeoutputlink" title="execution summary">&nbsp;&nbsp;&nbsp;&nbsp;</a>';
          buildNoRow          = '<td nowrap="true">' + chartData.buildNo[index] + '</td>';
          totalScriptRow      = '<td nowrap="true">' + chartData.totalScripts[index] + '</td>';
        } else {
          linkColumn = '<a href="' + chartData.downloadLinks[index] + '" target="_blank" ' +
                       'class="downloadlink" title="download">&nbsp;&nbsp;&nbsp;&nbsp;</a>';

          let iterationName  = chartData.name[index];
          dateTimeRowContent = '<td nowrap="true" class="dateTime">' + chartData.shrinkedLabels[index] + '</td>';

          if (iterationName.length > MAX_ITERATION_NAME_LENGTH) {
            dateTimeRowContent = '<td nowrap="true" class="dateTime" title="' + chartData.name[index] + '">' +
                                 chartData.shrinkedLabels[index] +
                                 '</td>';
          }
        }

        rowIndex++;

        return '<tr align="center">' +
               '<td nowrap="true" class="link">' + executionOutputLink + linkColumn + '</td>' +
               dateTimeRowContent +
               totalScriptRow +
               buildNoRow +
               '<td nowrap="true">' + chartData.stepCount[index] + '</td>' +
               '<td nowrap="true">' + chartData.passCount[index] + '</td>' +
               '<td nowrap="true">' + chartData.failCount[index] + '</td>' +
               '<td nowrap="true">' + chartData.successPercent[index] + '</td>' +
               '<td nowrap="true">' + chartData.durationInHHMMSS[index] + '</td>' +
               '</tr>';
      }
    ).reverse().join());

  return table;
}

function newSummaryStat(/*String*/title,/*String*/icon, /*String*/value) {
  return '<div class="summarystats_div">' +
         '<div class="summarystats_icon_div" title="' + title + '">' +
         '<i class="' + icon + ' icon_font_size" aria-hidden="true"></i>' +
         '<label class="summarystats_label">' + value + '</label>' +
         '</div>' +
         '</div>';
}

function displayExecutionSummaryStats(divId, chartData) {
  let div = $('#' + divId);
  div.append(newSummaryStat('Average fail steps', 'fas fa-bug', chartData.avgFailCount) +
             newSummaryStat('Average execution time', 'far fa-clock', chartData.avgExecutionTime) +
             newSummaryStat('Average steps executed per run', 'fas fa-tasks', chartData.avgStepCount) +
             newSummaryStat('Average executions per day', 'far fa-calendar', chartData.avgExecPerDay));
  return div;
}

function calculateExecutionStats(chartData) {
  if (chartData.totalFailCount !== 0) {
    chartData.avgFailCount = (chartData.totalFailCount / chartData.labels.length).toFixed(2);
  } else {
    chartData.avgFailCount = 0;
  }

  if (chartData.totalDuration !== 0) {
    chartData.totalDuration    = chartData.totalDuration / chartData.labels.length;
    chartData.totalDuration    = chartData.totalDuration / 1000;
    chartData.avgExecutionTime = chartData.totalDuration.toHHMMSS();
  }

  if (chartData.totalStepCount !== 0) {
    chartData.avgStepCount = (chartData.totalStepCount / chartData.labels.length).toFixed(2);
  } else {
    chartData.avgStepCount = 0;
  }

  chartData.avgExecPerDay = chartData.dateValues.length;
  chartData.dateValues    = chartData.dateValues.slice().sort();
  let duplicateCount      = 1;
  for (let i = 0; i < chartData.dateValues.length - 1; i++) {
    if (chartData.dateValues[i + 1] !== chartData.dateValues[i]) { duplicateCount = duplicateCount + 1; }
  }

  if (duplicateCount !== 1) { chartData.avgExecPerDay = (chartData.avgExecPerDay / duplicateCount).toFixed(); }

  return chartData;
}

