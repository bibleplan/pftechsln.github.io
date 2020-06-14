import { loadSampleData } from './loadSampleFhirData.js';
import { loadEpicFhirOrgs } from './EpicEndpoints.js';
import { FhirPatient, FhirResource } from './fhirModel.js';

export class FhirControl {
  static fhirSettings;

  static async loadEpicFhirOrgs($scope) {
    let epicEndPointUrl = './data/EpicEndPoints.json';

    let response = await fetch(epicEndPointUrl);
    let data = await response.json();
    console.log('epicorg', response, data);
    $scope.fhirOrgs = data.Entries;
    $scope.$apply();
    //return data;
    //return loadEpicFhirOrgs();
  }

  static loadSampleData($scope, $http) {
    loadSampleData($scope);
  }

  static setFhirSettings(endpointUrl, client) {
    var fhirSettings = {};

    fhirSettings.endpointUrl = endpointUrl;
    fhirSettings.clientId = client.clientId;
    fhirSettings.redirectUri = client.redirectUri;

    fhirSettings.baseUrl = endpointUrl.replace('api/FHIR/DSTU2/', '');
    fhirSettings.authUrl =
      fhirSettings.baseUrl +
      'oauth2/authorize?response_type=code&client_id=' +
      client.clientId +
      '&redirect_uri=' +
      client.redirectUri;
    fhirSettings.tokenUrl = fhirSettings.baseUrl + 'oauth2/token';
    fhirSettings.metaUrl = fhirSettings.endpointUrl + 'metadata';

    sessionStorage.setItem('fhirSettings', fhirSettings);
    this.fhirSettings = fhirSettings;
    console.log('fhirSettings: ', this.fhirSettings);
  }

  static loadFhirData($scope, $http) {
    loadFhirData($scope, $http);
  }
}

function resetProgress($scope) {
  $scope.progress = 0;
  $scope.progressError = 0;
  $('#progressWrap').prop('hidden', true);
  $('#progressBar').attr('style', 'width: ' + 0 + '%;');
  $('#progressBar').attr('aria-valuenow', 0);
  $('#progressBar').html('');
  $('#progressBarError').attr('style', 'width: ' + 0 + '%;');
  $('#progressBarError').attr('aria-valuenow', 0);
  $('#progressBarError').html('');
}

function updateProgress($scope, isError) {
  let progress = 0;

  if (isError) {
    $scope.progressError++;
    const progress = Math.round(
      (100 * $scope.progressError) / $scope.rsrTypeList.length
    );
    $('#progressBarError').attr('style', 'width: ' + progress + '%;');
    $('#progressBarError').attr('aria-valuenow', progress);
    $('#progressBarError').html(progress + '%');
  } else {
    $scope.progress++;
    const progress = Math.round(
      (100 * $scope.progress) / $scope.rsrTypeList.length
    );
    $('#progressBar').attr('style', 'width: ' + progress + '%;');
    $('#progressBar').attr('aria-valuenow', progress);
    $('#progressBar').html(progress + '%');
  }

  if ($scope.progress + $scope.progressError >= $scope.rsrTypeList.length) {
    $scope.progress = 0;
    $scope.progressError = 0;
    window.setTimeout(() => {
      resetProgress($scope);
    }, 3000);
    console.log('load completed: ', $scope.fhirRsrList);
  }
}

// Load patient demographic, and conformance first
function loadFhirData($scope, $http) {
  // Clear existing data if any
  $scope.fhirRsrList = [];
  $scope.rawFhirRsrList = [];

  loadAllFhirResources($scope, $http);
}

async function loadAllFhirResources($scope, $http) {
  $('#progressWrap').prop('hidden', false);
  $scope.progress = 0;
  $scope.progressError = 0;

  await getPatData({ name: 'Conformance' }, $scope, $http);

  $scope.rsrTypeList.forEach((type) => {
    console.log('loading ... ', type.name);
    getPatData(type, $scope, $http);
  });
}

// Retrive patient data
async function getPatData(resource, $scope, $http) {
  var url = $scope.fhirEndpointUrl;
  const type = resource.displayOverride
    ? resource.displayOverride
    : resource.name;

  // Conformance
  if (resource.name === 'Conformance') {
    //getResource(resource, metadataUrl);
    url = $scope.fhirMetaUrl;
  }

  // Resources w/o qualifier
  else if (resource.name === 'Patient') {
    url = url + '/' + resource.name + '/' + $scope.patient;
  }

  // Resources with qualifier
  else if (resource.queryFilter) {
    url =
      url +
      '/' +
      resource.name +
      '?patient=' +
      $scope.patient +
      '&' +
      resource.queryFilter;
  }

  // patient Demographics
  else {
    url = url + '/' + resource.name + '?patient=' + $scope.patient;
  }

  console.log('GET: ', url);

  $http.defaults.headers.common['Authorization'] =
    'Bearer ' + $scope.accessToken;

  try {
    // const response = await $http({
    //   method: 'GET',
    //   url: url,
    // });

    //fetch;
    const response = await fetch(url, {
      headers: {
        Authorization: 'Bearer ' + $scope.accessToken,
        Accept: 'application/json, text/plain, */*',
      },
    });

    var json;
    if (response.ok) {
      json = await response.json();
      console.log('fetch resp', json);
    }
    console.log('http', response, response.ok);

    const substance = json; //response.data; //.entry[0];
    const jsonString = JSON.stringify(substance, undefined, 2);

    $scope.rawFhirRsrList.push({
      type: type,
      json: jsonString,
      full: substance,
    });

    $('#data' + type).html(jsonString);

    let entityCount = 1;
    if (substance['resourceType'] === 'Bundle') {
      entityCount = substance.total;
    } else {
      entityCount = 1;
    }
    $('#cnt' + type).html(entityCount);
    $('#cnt' + type).addClass('bg-warning');
    $('#cnt2' + type).html(entityCount);
    $('#cnt2' + type).addClass('bg-success');
    $('#cnt2' + type).addClass('text-light');
    $('#cnt2' + type).removeClass('bg-warning');
    $('#' + type).html(jsonString);

    // dont update progress yet for the Confromance call because rsrTypeList not available
    if ($scope.rsrTypeList && type !== 'Conformance') {
      updateProgress($scope);
    }

    extractFhirData(resource, substance, $scope);
  } catch (error) {
    console.log('Error loading ', resource.name, ': ', error);
    $('#cnt2' + resource.name).html('Error');
    $('#cnt2' + resource.name).addClass('bg-danger');
    $('#cnt2' + resource.name).removeClass('bg-warning');
    $('#' + resource.name).html(error.status + ' ' + error.statusText);

    updateProgress($scope, 1);
  }
}

function extractFhirData(resource, data, $scope) {
  if (resource.name === 'Conformance') {
    $scope.rsrTypeList = FhirResource.extractResourceTypes(data);
  } else if (resource.name === 'Patient') {
    let oneResource = FhirResource.createResource(data);
    $scope.fhirRsrList.push(oneResource);
  } else {
    data.entry.forEach((aJson) => {
      let oneResource = FhirResource.createResource(
        aJson,
        resource.displayOverride
      );
      $scope.fhirRsrList.push(oneResource);
    });
  }

  $scope.$apply();
  return;
}

/* 
  if (resource.name === 'Patient') {
    displayPatient(data, $scope);
  } else if (resource.name === 'AllergyIntolerance') {
    displayAllergy(data, $scope);
  } else if (resource.name === 'Immunization') {
    extractImmunization(data, $scope);
  } else if (resource.name === 'MedicationOrder') {
    extractMedication(data, $scope);
  }
  //*RLI 7/24/17
  else if (resource.displayOverride === 'Observation-laboratory') {
    extractLab(data, $scope);
  } else if (resource.name === 'Conformance') {
    displayConformance(data, $scope);
  } 
}

/* 
// Load other Fhir resources after Demographics and Conformance
function loadFhirResources($scope, $http) {
  getPatData({ name: 'AllergyIntolerance' }, $scope, $http);
  getPatData({ name: 'Immunization' }, $scope, $http);
  getPatData({ name: 'MedicationOrder' }, $scope, $http);
  getPatData(
    {
      name: 'Observation',
      queryFilter: 'category=laboratory',
      displayOverride: 'Observation-laboratory',
    },
    $scope,
    $http
  );
}
function displayPatient(data, $scope) {
  var patient = {
    Name: '',
    'FHIR ID': '',
    Gender: '',
    'Date of Birth': '',
    Address: '',
    'Home Phone': '',
    'Work Phone': '',
    'Mobile Phone': '',
    Email: '',
  };
  var address;
  var phone;
  var tmp;

  patient['Date of Birth'] = data.birthDate;
  patient['Gender'] = data.gender;
  patient['FHIR ID'] = data.id;
  patient['Name'] = data.name[0].given + ' ' + data.name[0].family;

  for (var ln = 0; ln < data.address.length; ln++) {
    if (data.address[ln].use === 'home') {
      address = data.address[ln].line.join(' ');
      address =
        address +
        ', ' +
        data.address[ln].city +
        ', ' +
        data.address[ln].state +
        ' ' +
        data.address[ln].postalCode +
        ', ' +
        data.address[ln].country;
    }
  }
  patient['Address'] = address;

  for (var ln = 0; ln < data.telecom.length; ln++) {
    tmp = data.telecom[ln];
    if (tmp.system === 'phone') {
      if (tmp.use === 'home') {
        patient['Home Phone'] = tmp.value;
      } else if (tmp.use === 'work') {
        patient['Work Phone'] = tmp.value;
      } else if (tmp.use === 'mobile') {
        patient['Mobile Phone'] = tmp.value;
      }
    } else if (tmp.system === 'email') {
      patient['Email'] = tmp.value;
    }
  }

  var fhirRsr = {
    Type: 'Patient',
    Name: patient.Name,
    Resource: patient,
    SourceLink: $scope.fhirMetaUrl,
    SourceName: $scope.orgName,
    Full_Resource: data.fullUrl,
    display: FhirView.getRsrSetting('Patient'),
  };
  $scope.fhirRsrList.push(fhirRsr);
  //console.log(fhirRsr);
  $scope.patientDemo = patient;
}

function displayAllergy(data, $scope) {
  var tmpEntry;
  var tmpStr = '';
  var fhirRsr;
  const displaySetting = FhirView.getRsrSetting('AllergyIntolerance');

  if (data.total < 1) {
    return;
  }

  var allergies = new Array(data.total);

  try {
    for (var ln = 0; ln < data.total; ln++) {
      var oneAllergy = {
        Substance: '',
        Status: '',
        'Recorded Date': '',
        Reaction: '',
        Note: '',
      };
      allergies[ln] = oneAllergy;

      tmpEntry = data.entry[ln].resource;

      oneAllergy['Substance'] = tmpEntry.substance.text;
      oneAllergy['Status'] = tmpEntry.status;
      oneAllergy['Recorded Date'] = tmpEntry.recordedDate.split('T')[0];

      if (typeof tmpEntry['reaction'] == 'undefined') {
        oneAllergy['Reaction'] = '';
      } else {
        tmpStr = '';
        for (var ln2 = 0; ln2 < tmpEntry.reaction.length; ln2++) {
          if (ln2 > 0) {
            tmpStr = tmpStr + ', ';
          }
          tmpStr = tmpStr + tmpEntry.reaction[ln2].manifestation[0].text;
        }
        oneAllergy['Reaction'] = tmpStr;
      }

      if (typeof tmpEntry['note'] == 'undefined') {
        oneAllergy['Note'] = '';
      } else {
        oneAllergy['Note'] = tmpEntry.note.text;
      }
      //allergies[ln] = oneAllergy;

      fhirRsr = {
        Type: 'AllergyIntolerance',
        Name: oneAllergy.Substance,
        Resource: oneAllergy,
        SourceLink: $scope.fhirMetaUrl,
        SourceName: $scope.orgName,
        Full_Resource: data.entry[ln].fullUrl,
        display: displaySetting,
      };
      $scope.fhirRsrList.push(fhirRsr);
      //console.log(fhirRsr);
    }
  } catch (error) {
    //. ignore 
  }

  //$scope.allergies = allergies;
}

function extractImmunization(data, $scope) {
  var tmpEntry;
  var tmpStr = '';
  const displaySetting = FhirView.getRsrSetting('Immunization');

  if (data.total < 1) {
    return;
  }

  var immunizations = new Array(data.total);

  try {
    for (var ln = 0; ln < data.total; ln++) {
      tmpEntry = data.entry[ln].resource;
      if (tmpEntry.resourceType === 'Immunization') {
        var oneImm = {
          Vaccine: '',
          Date: '',
          Site: '',
          Route: '',
        };
        immunizations[ln] = oneImm;

        oneImm['Vaccine'] = tmpEntry.vaccineCode.text;
        oneImm['Date'] = tmpEntry.date.split('T')[0];

        if (typeof tmpEntry['site'] == 'undefined') {
          oneImm['Site'] = '';
        } else {
          oneImm['Site'] = tmpEntry.site.text;
        }

        if (typeof tmpEntry['route'] == 'undefined') {
          oneImm['Route'] = '';
        } else {
          oneImm['Route'] = tmpEntry.route.text;
        }
      }
    }
  } catch (error) {}

  $scope.immunizations = immunizations;
}

// *RLI 7/24/17

function extractLab(data, $scope) {
  var tmpEntry;
  var tmpStr = '';
  var unit = '';

  if (data.total < 1) {
    return;
  }

  var labs = new Array(data.total);

  try {
    for (var ln = 0; ln < data.total; ln++) {
      tmpEntry = data.entry[ln].resource;
      if (tmpEntry.resourceType === 'Observation') {
        var oneLab = {
          Test: '',
          Date: '',
          Status: '',
          'Result Value': '',
          'Reference Range': '',
          Unit: '',
        };
        labs[ln] = oneLab;

        oneLab['Test'] = tmpEntry.code.text;
        oneLab['Date'] = tmpEntry.effectiveDateTime.split('T')[0];
        oneLab['Status'] = tmpEntry.status;

        tmpStr = '';
        unit = '';
        if (typeof tmpEntry['valueQuantity'] != 'undefined') {
          tmpStr = tmpEntry.valueQuantity.value;
          unit = tmpEntry.valueQuantity.unit;
        } else if (typeof tmpEntry['valueRatio'] != 'undefined') {
          tmpStr =
            tmpEntry.valueRatio.denominator.value +
            '/' +
            tmpEntry.valueRatio.numerator.value;
        } else {
        }
        oneLab['Result Value'] = tmpStr;

        tmpStr = '';
        if (typeof tmpEntry['referenceRange'] == 'undefined') {
          tmpStr = '';
        } else {
          tmpStr = tmpEntry.referenceRange[0].text;
          tmpStr = tmpStr.split(unit)[0];
        }
        oneLab['Reference Range'] = tmpStr;
        oneLab['Unit'] = unit;
      }
    }
  } catch (error) {
    alert(error);
  }

  $scope.labs = labs;
}

function extractMedication(data, $scope) {
  var tmpEntry;
  var tmpStr = '';
  const dsiplaySetting = FhirView.getRsrSetting('MedicationOrder');

  if (data.total < 1) {
    return;
  }

  var medications = new Array(data.total);

  try {
    for (var ln = 0; ln < data.total; ln++) {
      tmpEntry = data.entry[ln].resource;
      if (tmpEntry.resourceType === 'MedicationOrder') {
        var oneMed = {
          Medication: '',
          Date: '',
          Status: '',
          Prescriber: '',
          'Dosage Instruction': '',
        };
        medications[ln] = oneMed;

        oneMed['Medication'] = tmpEntry.medicationReference.display;
        oneMed['Date'] = tmpEntry.dateWritten.split('T')[0];
        oneMed['Status'] = tmpEntry.status;

        if (typeof tmpEntry['prescriber'] == 'undefined') {
          oneMed['Prescriber'] = '';
        } else {
          oneMed['Prescriber'] = tmpEntry.prescriber.display;
        }

        if (typeof tmpEntry['dosageInstruction'] == 'undefined') {
          oneMed['Dosage Instruction'] = '';
        } else {
          oneMed['Dosage Instruction'] = tmpEntry.dosageInstruction[0].text;
        }

        fhirRsr = {
          Type: 'Medication',
          Name: oneMed.Medication,
          Resource: oneMed,
          SourceLink: $scope.fhirMetaUrl,
          SourceName: $scope.orgName,
          Full_Resource: data.entry[ln].fullUrl,
          display: displaySetting,
        };
        $scope.fhirRsrList.push(fhirRsr);
        //console.log(fhirRsr);
      }
    }
  } catch (error) {}

  //$scope.medications = medications;
}
 */
