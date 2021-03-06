// interval in seconds
var scheduleTimeout, updateTimeout, isScheduled = true, interval = 5;

(function () {
    var oldDate, oldValues = [];

    function getSize(size) {
        var prefix = [' ', 'k', 'M', 'G', 'T', 'P', 'E', 'Z'];
        var precision, base = 1000, pos = 0;
        while (size > base) {
            size /= base;
            pos++;
        }
        if (pos > 2) precision = 1000; else precision = 1;
        return (Math.round(size * precision) / precision) + ' ' + prefix[pos] + 'B';
    }

    function dateToString(date) {
        return date.toString().substring(0, 24);
    }

    function getDateString(value) {
        var tmp = value.split('_'),
            str = tmp[0].split('-').reverse().join('-') + 'T' + tmp[1];
        return dateToString(new Date(str));
    }

    function isArray(obj) {
        return obj instanceof Array;
    }

    function handleError() {
        // TODO handle errors
        // var message = 'Something went wrong...';
    }

    function handleValues(values) {
        if (!isArray(values)) return '';

        // find data
        var data = [], totals = [0, 0, 0, 0, 0];
        for (var i = 0; i < values.length; i++) {
            var d = handleRow(values[i]);
            if (d[1]) {
                data.push(d);
                // get totals
                for (var j = 0; j < totals.length; j++) {
                    totals[j] += d[1][3 + j];
                }
            }
        }

        // sort data
        data.sort(function (x, y) {
            var a = x[1], b = y[1];
            for (var i = 3; i <= 7; i++) {
                if (a[i] < b[i]) return 1;
                if (a[i] > b[i]) return -1;
            }
            return 0;
        });

        // display data
        var result = '<tr>\
                            <th>Client</th>\
                            <th>Download</th>\
                            <th>Upload</th>\
                            <th>Total Down</th>\
                            <th>Total Up</th>\
                            <th>Total</th>\
                            <th>First Seen</th>\
                            <th>Last Seen</th>\
                          </tr>';
        for (var k = 0; k < data.length; k++) {
            result += data[k][0];
        }
        result += '<tr><th>TOTAL</th>';
        for (var m = 0; m < totals.length; m++) {
            var t = totals[m];
            result += '<td align="right">' + getSize(t) + (m < 2 ? '/s' : '') + '</td>'
        }
        result += '</tr>';
        return result;

        function handleRow(data) {
            // check if data is array
            if (!isArray(data)) return [''];

            // find old data
            var oldData;
            for (var i = 0; i < oldValues.length; i++) {
                var cur = oldValues[i];
                // compare mac addresses and ip addresses
                if (oldValues[i][1] === data[1] && oldValues[i][2] === data[2]) {
                    oldData = cur;
                    break;
                }
            }

            // find download and upload speeds
            var dlSpeed = 0, upSpeed = 0;
            if (oldData) {
                var now = new Date(),
                    seconds = (now - oldDate) / 1000;
                dlSpeed = (data[3] - oldData[3]) / seconds;
                upSpeed = (data[4] - oldData[4]) / seconds;
            }

            // create rowData
            var rowData = [];
            for (var j = 0; j < data.length; j++) {
                rowData.push(data[j]);
                if (j === 2) {
                    rowData.push(dlSpeed, upSpeed);
                }
            }

            // create displayData
            var displayData = [
                '<td title="' + data[1] + '">' + data[0] + '<br />' + data[2] + '</td>',
                '<td align="right">' + getSize(dlSpeed) + '/s</td>',
                '<td align="right">' + getSize(upSpeed) + '/s</td>',
                '<td align="right">' + getSize(data[3]) + '</td>',
                '<td align="right">' + getSize(data[4]) + '</td>',
                '<td align="right">' + getSize(data[5]) + '</td>',
                '<td>' + getDateString(data[6]) + '</td>',
                '<td>' + getDateString(data[7]) + '</td>'
            ];

            // display row data
            var result = '<tr>';
            for (var k = 0; k < displayData.length; k++) {
                result += displayData[k];
            }
            result += '</tr>';
            return [result, rowData];
        }
    }

    function receiveData(once) {
        var ajax = new XMLHttpRequest();
        ajax.onreadystatechange = function () {
            if (this.readyState == 4 && this.status == 200) {
                var re = /(var values = new Array[^;]*;)/,
                    match = ajax.responseText.match(re);
                if (!match) {
                    handleError();
                } else {
                    // evaluate values
                    eval(match[1]);
                    //noinspection JSUnresolvedVariable
                    var v = values;
                    if (!v) {
                        handleError();
                    } else {
                        document.getElementById('tableBody').innerHTML = handleValues(v);
                        // set old values
                        oldValues = v;
                        // set old date
                        oldDate = new Date();
                        document.getElementById('updated').innerHTML = 'Last updated ' + dateToString(oldDate);
                    }
                }
                if (!once && interval > 0) reschedule(interval);
            }
        };
        ajax.open('GET', 'usage_data', true);
        ajax.send();
    }

    document.getElementById('intervalSelect').addEventListener('change', function () {
        interval = this.value;
        if (interval > 0) {
            // it is not scheduled, schedule it
            if (!isScheduled) {
                reschedule(interval);
            }
        } else {
            // stop the scheduling
            stopSchedule();
        }
    });

    document.getElementById('resetDatabase').addEventListener('click', function () {
        if (confirm('This will delete the database file. Are you sure?')) {
            var ajax = new XMLHttpRequest();
            ajax.onreadystatechange = function () {
                if (this.readyState == 4 && this.status == 204) {
                    location.reload();
                }
            };
            ajax.open('GET', 'usage_reset', true);
            ajax.send();
        }
    });

    function stopSchedule() {
        window.clearTimeout(scheduleTimeout);
        window.clearTimeout(updateTimeout);
        setUpdateMessage('');
        isScheduled = false;
    }

    function reschedule(seconds) {
        isScheduled = true;
        seconds = seconds || 60;
        updateSeconds(seconds);
        scheduleTimeout = window.setTimeout(receiveData, seconds * 1000);
    }

    function setUpdateMessage(msg) {
        document.getElementById('updating').innerHTML = msg;
    }

    function updateSeconds(start) {
        setUpdateMessage('Updating again in <b>' + start + '</b> seconds.');
        if (start > 0) {
            updateTimeout = window.setTimeout(function () {
                updateSeconds(start - 1);
            }, 1000);
        }
    }

    receiveData();
})();
