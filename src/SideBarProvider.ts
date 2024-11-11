import * as vscode from "vscode";
import { getUpdate, putRecord } from "./TimeTaggerData";

export class SidebarProvider implements vscode.WebviewViewProvider {
  _view?: vscode.WebviewView;
  _doc?: vscode.TextDocument;
  recordId: string;
  startTime: number;
  descriptionTitle: string;

  constructor(
    private readonly _extensionUri: vscode.Uri
  ) {
    this.recordId = "";
    this.startTime = -1;
    this.descriptionTitle = "";
  }

  public resolveWebviewView(webviewView: vscode.WebviewView) {
    this._view = webviewView;
    webviewView.webview.options = {
      // Allow scripts in the webview
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Listen for messages from the Sidebar component and execute action
    webviewView.webview.onDidReceiveMessage(async (data) => {
        switch (data.type) {
          case "CheckRecord": {
            let records = await getUpdate(
              vscode.workspace.getConfiguration().get<string>('tte.serverUrl') as string, 
              vscode.workspace.getConfiguration().get<string>('tte.token') as string,
              ((Date.now()/1000) - (86400*2)).toString() //get from 2 day previous
            )
            console.log(records.records)
            if(records.records.length === 0 || (records.records.at(-1).t1 !== records.records.at(-1).t2)){
              webviewView.webview.postMessage({
                command: "timeStop",
                des: ""
              });
            }
            else {
              this.recordId = records.records.at(-1).key;
              this.startTime = records.records.at(-1).t1;
              this.descriptionTitle = records.records.at(-1).ds;
              webviewView.webview.postMessage({
                command: "timeRunning",
                startTime: records.records.at(-1).t1,
                des: records.records.at(-1).ds
              });
            }
            break;
          }
          case "StartRecord": {
            this.startTime = Date.parse(data.startTime)/1000;
            this.descriptionTitle = data.des;
            this.recordId = this.uuidv4Generator();
            const returnRecordStatus = await putRecord(
              vscode.workspace.getConfiguration().get<string>('tte.serverUrl') as string, 
              vscode.workspace.getConfiguration().get<string>('tte.token') as string,
              this.recordId,
              data.des,
              this.startTime,
              this.startTime
            );
            vscode.window.showInformationMessage(returnRecordStatus as string);
            break;
          }
          case "StopRecord": {
            const returnRecordStatus = await putRecord(
              vscode.workspace.getConfiguration().get<string>('tte.serverUrl') as string, 
              vscode.workspace.getConfiguration().get<string>('tte.token') as string,
              this.recordId,
              data.des,
              this.startTime,
              Date.now()/1000
            );
            vscode.window.showInformationMessage(returnRecordStatus as string);
            if (returnRecordStatus === "Save Successfully") {
              this.startTime = -1;
              this.descriptionTitle = "";
              this.recordId = ""
            }
            break;
          }
          case "GetRecord": {
            const resultRecordData = await getUpdate(
              vscode.workspace.getConfiguration().get<string>('tte.serverUrl') as string, 
              vscode.workspace.getConfiguration().get<string>('tte.token') as string,
              (Date.parse(data.timeSince)/1000).toString()
            );
            webviewView.webview.postMessage({
              command: "returnGetRecord",
              records: resultRecordData.records,
            });
            break;
          }
          case "UpdateRecord": {
            this.startTime = Date.parse(data.startTime)/1000;
            this.descriptionTitle = data.des;
            const returnRecordStatus = await putRecord(
              vscode.workspace.getConfiguration().get<string>('tte.serverUrl') as string, 
              vscode.workspace.getConfiguration().get<string>('tte.token') as string,
              this.recordId,
              data.des,
              this.startTime,
              this.startTime
            );
            vscode.window.showInformationMessage(returnRecordStatus as string);
          }
        }
    });
  }

  private uuidv4Generator() {
    return "00000000-0000-0000-0000-000000000000".replace(/[018]/g, c =>
      (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
    );
  }

  public revive(panel: vscode.WebviewView) {
    this._view = panel;
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const styleResetUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "reset.css")
    );
    const styleVSCodeUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "media", "vscode.css")
    );

    return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<link href="${styleResetUri}" rel="stylesheet">
				<link href="${styleVSCodeUri}" rel="stylesheet">
                <style>
                table, th, td {
                    border: 1px solid black;
                    border-collapse: collapse;
                    border-color: #FFFFFF;
                }
                </style>
			</head>
  <body>
    <h1>TimeTagger Extension for VSCode</h1>
    <h2>NEW RECORD</h2>
    <div id="time_option_block">
      <label>Description:</label>
      <input
        style="border-top: 0px; border-left: 0px; border-right: 0px"
        id="description"
        onchange="updateRecord()"
      />
      <br />
      <label>Start date:</label>
      <input type="date" id="start_date" onchange="updateRecord()" required />
      <label>Start time:</label>
      <input type="time" id="start_time" onchange="updateRecord()" required />
      <br />
      <div id="time_option_timer">
        <label>Timer:</label>
        <label id="hours">00</label>
        <label id="colon">:</label>
        <label id="minutes">00</label>
        <label id="colon">:</label>
        <label id="seconds">00</label>
      </div>
      <button type="button" id="time_option_btn" onclick="startTime()">
        Start
      </button>
    </div><br><br>
    <h2>GET RECORDS</h2>
    <label>Start date:</label>
    <input type="date" id="get_records_date" required />
    <label>Start time:</label>
    <input type="time" id="get_records_time" required />
    <button type="button" id="get_records" onClick="getRecord()">
      Get record
    </button>
    <table id="records_table">
      
    </table>

    <script type="text/javascript">
      //Init var
      //VSCode Function
      const vscode = acquireVsCodeApi();
      var hoursLabel = document.getElementById("hours");
      var minutesLabel = document.getElementById("minutes");
      var secondsLabel = document.getElementById("seconds");
      var totalSeconds = 0;
      var timeInterval;
      var runningTime = false;

      //onStart
      function checkRecord(){
        vscode.postMessage(
          JSON.parse(
            JSON.stringify({
              type: "CheckRecord"
            })
          )
        );
      }
      let currentTime = new Date();
      document.getElementById("get_records_time").defaultValue = "01:00:01";
            document.getElementById("get_records_date").value = [
              currentTime.getFullYear(),
              (currentTime.getMonth() + 1).toString().padStart(2, "0"),
              currentTime.getDate().toString().padStart(2, "0"),
            ].join("-");
      checkRecord();
      setInterval(getRecord, 5000)
      setInterval(checkRecord,5000)

      //onClick
      function startTime() {
          if (!runningTime) {
            vscode.postMessage(
            JSON.parse(
              JSON.stringify({
                type: "StartRecord",
                startTime: document.getElementById("start_time").value + " " + document.getElementById("start_date").value,
                des: document.getElementById("description").value
              })
            )
          );
          timeInterval = setInterval(setTime, 1000);
          runningTime = true;
          document.getElementById("time_option_btn").textContent = "End";
        } else {
          totalSeconds = 0;
          runningTime = false;
          let theMomment = new Date();
          document.getElementById("start_time").defaultValue =
            theMomment.toLocaleTimeString("vi-VN", {
              hour12: false,
              hour: "numeric",
              minute: "numeric",
              second: "numeric",
            });
          document.getElementById("start_date").value = [
            theMomment.getFullYear(),
            (theMomment.getMonth() + 1).toString().padStart(2, "0"),
            theMomment.getDate().toString().padStart(2, "0"),
          ].join("-");
          hoursLabel.innerHTML = "00";
          minutesLabel.innerHTML = "00";
          secondsLabel.innerHTML = "00";
          document.getElementById("time_option_btn").textContent = "Start";
          putRecord(
            document.getElementById("description").value,
            Date.parse(
              document.getElementById("start_date").value.replaceAll("-", "/") +
                " " +
                document.getElementById("start_time").value
            ) / 1000,
            Date.parse(new Date()) / 1000
          );
          clearInterval(timeInterval);
        }
      }

      //onChange
      function updateTime() {
        totalSeconds =
          Date.parse(new Date()) -
          Date.parse(
            document.getElementById("start_date").value.replaceAll("-", "/") +
              " " +
              document.getElementById("start_time").value
          );
        totalSeconds = parseInt(totalSeconds / 1000);
      }

      //Other function

      function setTime(time) {
        ++totalSeconds;
        let timeLabes = totalSeconds.toString().toHHMMSS();
        // let timeLabes = ((Date.now()/1000) - time).toString().toHHMMSS();
        secondsLabel.innerHTML = timeLabes[2];
        minutesLabel.innerHTML = timeLabes[1];
        hoursLabel.innerHTML = timeLabes[0];
      }

      String.prototype.toHHMMSS = function () {
        var sec_num = parseInt(this, 10); // don't forget the second param
        var hours = Math.floor(sec_num / 3600);
        var minutes = Math.floor((sec_num - hours * 3600) / 60);
        var seconds = sec_num - hours * 3600 - minutes * 60;

        if (hours < 10) {
          hours = "0" + hours;
        }
        if (minutes < 10) {
          minutes = "0" + minutes;
        }
        if (seconds < 10) {
          seconds = "0" + seconds;
        }
        return [hours, minutes, seconds];
      };

      function timestampTodatetime(timestamp) {
        let date = new Date(timestamp * 1000);
        let day =
          (date.getMonth() + 1).toString().padStart(2, "0") +
          "/" +
          date.getDate().toString().padStart(2, "0") +
          "/" +
          date.getFullYear() +
          " ";
        let time =
          date.getHours().toString().padStart(2, "0") +
          ":" +
          date.getMinutes().toString().padStart(2, "0") +
          ":" +
          date.getSeconds().toString().padStart(2, "0");
        return "Day: " + day + "Time: " + time;
      }
      
      // Handle the message inside the webview
      window.addEventListener("message", (event) => {
        const message = event.data; // The JSON data our extension sent

        switch (message.command) {
          case "returnGetRecord": {
            let table_cols =
              "<tr><th>Description</th><th>From</th><th>To</th></tr>";
            message.records.filter(r=>!r.ds?.includes("HIDDEN")).forEach(
              (data) =>
                {table_cols +=
                  "<tr><td>" +
                  (data.ds !== undefined ? data.ds : "") +
                  "</td><td>" +
                  timestampTodatetime(data.t1) +
                  "</td><td>" +
                  (data.t2 != data.t1 ? timestampTodatetime(data.t2) : "Running") +
                  "</td></tr>"}
            );
            document.getElementById("records_table").innerHTML = table_cols;
            break;
          }
          case "timeStop": {
            runningTime = false;
            totalSeconds = 0;
            clearInterval(timeInterval);
            let currentTime = new Date();
            document.getElementById("time_option_btn").textContent = "Start";
            document.getElementById("start_time").defaultValue =
              currentTime.toLocaleTimeString("vi-VN", {
                hour12: false,
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
              });
            document.getElementById("start_date").value = [
              currentTime.getFullYear(),
              (currentTime.getMonth() + 1).toString().padStart(2, "0"),
              currentTime.getDate().toString().padStart(2, "0"),
            ].join("-");
            // document.getElementById("get_records_time").defaultValue = "01:00:01";
            // document.getElementById("get_records_date").value = [
            //   currentTime.getFullYear(),
            //   (currentTime.getMonth() + 1).toString().padStart(2, "0"),
            //   currentTime.getDate().toString().padStart(2, "0"),
            // ].join("-");
            updateTime();
            hoursLabel.innerHTML = "00";
            minutesLabel.innerHTML = "00";
            secondsLabel.innerHTML = "00";
            break;
          }
          case "timeRunning": {
            if (!runningTime) {
              timeInterval = setInterval(setTime, 1000);
              }
            runningTime = true;
            // setTime(message.startTime)
            document.getElementById("time_option_btn").textContent = "End";
            document.getElementById("description").value = (message.des!==undefined?message.des:"");
            let currentTime = new Date(message.startTime *1000);
            document.getElementById("start_time").defaultValue =
              currentTime.toLocaleTimeString("vi-VN", {
                hour12: false,
                hour: "numeric",
                minute: "numeric",
                second: "numeric",
              });
            document.getElementById("start_date").value = [
              currentTime.getFullYear(),
              (currentTime.getMonth() + 1).toString().padStart(2, "0"),
              currentTime.getDate().toString().padStart(2, "0"),
            ].join("-");
            // document.getElementById("get_records_time").defaultValue = "01:00:01";
            // document.getElementById("get_records_date").value = [
            //   currentTime.getFullYear(),
            //   (currentTime.getMonth() + 1).toString().padStart(2, "0"),
            //   currentTime.getDate().toString().padStart(2, "0"),
            // ].join("-");
            updateTime();
            break;
          }
        }
      });
      function getRecord() {
        vscode.postMessage({
          type: "GetRecord",
          timeSince: document.getElementById("get_records_time").value + " " + document.getElementById("get_records_date").value,
        });
      }
      function putRecord(description, timeFrom, timeTo) {
        vscode.postMessage(
          JSON.parse(
            JSON.stringify({
              type: "StopRecord",
              des: description,
              startTime: timeFrom,
              endTime: timeTo
            })
          )
        );
      }
      function updateRecord() {
      console.log(runningTime)
      if (runningTime){
        vscode.postMessage(
          JSON.parse(
            JSON.stringify({
              type: "UpdateRecord",
              des: document.getElementById("description").value,
              startTime: document.getElementById("start_time").value + " " + document.getElementById("start_date").value
            })
          )
        );
        updateTime();
        }
      }
    </script>
  </body>
			</html>`;
  }
}
