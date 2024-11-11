import axios from 'axios';

function toTimestamp(strDate: string){
  var datum = Date.parse(strDate);
  return (datum/1000).toString();
}

export async function getUpdate(apiUrl:string, token:string, since: string) {
  const returnRecordData = await axios.get(apiUrl + "updates?since=" + since, {
    headers: {
      authtoken: token //the token is a variable which holds the token
    }
   }).then(response => {
    return response.data;
  });
  return returnRecordData;
}

export async function putRecord(apiURL: string, token: string, recordId: string, description: string, timeFrom: number, timeTo: number) {
  console.log("putRecord: ", {
    "ds": description,
    "key": recordId, 
    "mt": Math.floor(Date.now() / 1000), //get current time as timestamp in second
    "st": 0,
    "t1": timeFrom,
    "t2": timeTo
  })
  const returnRecordStatus = await axios.request({
    method: 'put',
    url: apiURL + 'records',
    headers: { 
      'Content-Type': 'application/json', 
      'authtoken': token
    },
    data : JSON.stringify([{
      "ds": description,
      "key": recordId, 
      "mt": Math.floor(Date.now() / 1000), //get current time as timestamp in second
      "st": 0,
      "t1": timeFrom,
      "t2": timeTo
    }])
  })
  .then((response) => {
    return response.data;
  });
  if (returnRecordStatus.accepted.length !== 0) {
    return "Save Successfully";
  }
  if (returnRecordStatus.failed.length !== 0) {
    return "Save Failed";
  }
  if (returnRecordStatus.errors.length !== 0) {
    return "Something went wrong. Error(s): "+returnRecordStatus.errors.join(',');
  }
}