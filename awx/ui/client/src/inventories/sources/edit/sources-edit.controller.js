/*************************************************
 * Copyright (c) 2016 Ansible, Inc.
 *
 * All Rights Reserved
 *************************************************/

export default ['$state', '$stateParams', '$scope', 'ParseVariableString',
    'rbacUiControlService', 'ToJSON', 'ParseTypeChange', 'GetChoices', 'GetBasePath', 'CreateSelect2', 'GetSourceTypeOptions',
    'inventorySourceData', 'SourcesService', 'inventoryData', 'Empty', 'Wait', 'Rest', 'Alert', 'ProcessErrors',
    function($state, $stateParams, $scope, ParseVariableString,
        rbacUiControlService, ToJSON,ParseTypeChange, GetChoices, GetBasePath, CreateSelect2, GetSourceTypeOptions,
        inventorySourceData, SourcesService, inventoryData, Empty, Wait, Rest, Alert, ProcessErrors) {

        init();

        function init() {
            rbacUiControlService.canAdd(GetBasePath('inventory') + $stateParams.inventory_id + "/inventory_sources")
                .then(function(canAdd) {
                $scope.canAdd = canAdd;
            });

            // instantiate expected $scope values from inventorySourceData
            _.assign($scope,
                {credential: inventorySourceData.credential},
                {overwrite: inventorySourceData.overwrite},
                {overwrite_vars: inventorySourceData.overwrite_vars},
                {update_on_launch: inventorySourceData.update_on_launch},
                {update_cache_timeout: inventorySourceData.update_cache_timeout},
                {instance_filters: inventorySourceData.instance_filters},
                {inventory_script: inventorySourceData.source_script},
                {verbosity: inventorySourceData.verbosity});

            $scope.inventory_source_obj = inventorySourceData;
            if (inventorySourceData.credential) {
                $scope.credential_name = inventorySourceData.summary_fields.credential.name;
            }

            // display custom inventory_script name
            if (inventorySourceData.source === 'custom') {
                $scope.inventory_script_name = inventorySourceData.summary_fields.source_script.name;
            }
            $scope = angular.extend($scope, inventorySourceData);

            $scope.$watch('summary_fields.user_capabilities.edit', function(val) {
                $scope.canAdd = val;
            });

            $scope.envParseType = 'yaml';

            initSources();
        }

        var getInventoryFiles = function (project) {
            var url;

            if (!Empty(project)) {
                url = GetBasePath('projects') + project + '/inventories/';
                Wait('start');
                Rest.setUrl(url);
                Rest.get()
                    .success(function (data) {
                        $scope.inventory_files = data;
                        $scope.inventory_files.push("/ (project root)");

                        if (inventorySourceData.source_path !== "") {
                            $scope.inventory_file = inventorySourceData.source_path;
                            if ($scope.inventory_files.indexOf($scope.inventory_file) < 0) {
                                $scope.inventory_files.push($scope.inventory_file);
                            }
                        } else {
                            $scope.inventory_file = "/ (project root)";
                        }
                        sync_inventory_file_select2();
                        Wait('stop');
                    })
                    .error(function () {
                        Alert('Cannot get inventory files', 'Unable to retrieve the list of inventory files for this project.', 'alert-info');
                        Wait('stop');
                    });
            }
        };

        // Detect and alert user to potential SCM status issues
        var checkSCMStatus = function () {
            if (!Empty($scope.project)) {
                Rest.setUrl(GetBasePath('projects') + $scope.project + '/');
                Rest.get()
                    .success(function (data) {
                        var msg;
                        switch (data.status) {
                        case 'failed':
                            msg = "<div>The Project selected has a status of \"failed\". You must run a successful update before you can select an inventory file.";
                            break;
                        case 'never updated':
                            msg = "<div>The Project selected has a status of \"never updated\". You must run a successful update before you can select an inventory file.";
                            break;
                        case 'missing':
                            msg = '<div>The selected project has a status of \"missing\". Please check the server and make sure ' +
                                ' the directory exists and file permissions are set correctly.</div>';
                            break;
                        }
                        if (msg) {
                            Alert('Warning', msg, 'alert-info alert-info--noTextTransform', null, null, null, null, true);
                        }
                    })
                    .error(function (data, status) {
                        ProcessErrors($scope, data, status, null, { hdr: 'Error!',
                            msg: 'Failed to get project ' + $scope.project + '. GET returned status: ' + status });
                    });
            }
        };

        // Register a watcher on project_name
        if ($scope.getInventoryFilesUnregister) {
            $scope.getInventoryFilesUnregister();
        }
        $scope.getInventoryFilesUnregister = $scope.$watch('project', function (newValue, oldValue) {
            if (newValue !== oldValue) {
                getInventoryFiles(newValue);
                checkSCMStatus();
            }
        });

        function sync_inventory_file_select2() {
            CreateSelect2({
                element:'#inventory-file-select',
                addNew: true,
                multiple: false,
                scope: $scope,
                options: 'inventory_files',
                model: 'inventory_file'
            });

            // TODO: figure out why the inventory file model is being set to
            // dirty
        }

        $scope.lookupCredential = function(){
            $state.go('.credential', {
                credential_search: {
                    // TODO: get kind sorting for credential properly implemented
                    // kind: kind,
                    page_size: '5',
                    page: '1'
                }
            });
        };

        $scope.lookupProject = function(){
            $state.go('.project', {
                project_search: {
                    page_size: '5',
                    page: '1'
                }
            });
        };

        $scope.projectBasePath = GetBasePath('projects');

        var initRegionSelect = function() {
            CreateSelect2({
                element: '#inventory_source_source_regions',
                multiple: true
            });
            CreateSelect2({
                element: '#inventory_source_group_by',
                multiple: true
            });
        };

        $scope.lookupCredential = function(){
            let kind = ($scope.source.value === "ec2") ? "aws" : $scope.source.value;
            $state.go('.credential', {
                credential_search: {
                    kind: kind,
                    page_size: '5',
                    page: '1'
                }
            });
        };

        $scope.formCancel = function() {
            $state.go('^');
        };
        $scope.formSave = function() {
            var params;

            params = {
                id: inventorySourceData.id,
                name: $scope.name,
                description: $scope.description,
                inventory: inventoryData.id,
                instance_filters: $scope.instance_filters,
                source_script: $scope.inventory_script,
                credential: $scope.credential,
                overwrite: $scope.overwrite,
                overwrite_vars: $scope.overwrite_vars,
                update_on_launch: $scope.update_on_launch,
                update_cache_timeout: $scope.update_cache_timeout || 0,
                // comma-delimited strings
                group_by: _.map($scope.group_by, 'value').join(','),
                source_regions: _.map($scope.source_regions, 'value').join(',')
            };

            if ($scope.source) {
                params.source_vars = $scope[$scope.source.value + '_variables'] === '---' || $scope[$scope.source.value + '_variables'] === '{}' ? null : $scope[$scope.source.value + '_variables'];
                params.source = $scope.source.value;
                if ($scope.source.value === 'scm') {
                  params.update_on_project_update = $scope.update_on_project_update;
                  params.source_path = $scope.inventory_file;
                }
            } else {
                params.source = null;
            }

            SourcesService
              .put(params)
              .then(() => $state.go('.', null, { reload: true }));
        };

        $scope.sourceChange = function(source) {
            $scope.source = source;
            if (source.value === 'ec2' || source.value === 'custom' ||
                source.value === 'vmware' || source.value === 'openstack' ||
                source.value === 'scm') {

                var varName;
                if (source === 'scm') {
                    varName = 'custom_variables';
                } else {
                    varName = source + '_variables';
                }

                $scope[varName] = $scope[varName] === (null || undefined) ? '---' : $scope[varName];
                ParseTypeChange({
                    scope: $scope,
                    field_id: varName,
                    variable: varName,
                    parse_variable: 'envParseType',
                });
            }
            // reset fields
            // azure_rm regions choices are keyed as "azure" in an OPTIONS request to the inventory_sources endpoint
            $scope.source_region_choices = source.value === 'azure_rm' ? $scope.azure_regions : $scope[source.value + '_regions'];
            $scope.cloudCredentialRequired = source.value !== '' && source.value !== 'custom' && source.value !== 'scm' && source.value !== 'ec2' ? true : false;
            $scope.group_by = null;
            $scope.source_regions = null;
            $scope.credential = null;
            $scope.credential_name = null;

            initRegionSelect();
        };

        function initSourceSelect() {
            $scope.source = _.find($scope.source_type_options, { value: inventorySourceData.source });
            CreateSelect2({
                element: '#inventory_source_source',
                multiple: false
            });
            // After the source is set, conditional fields will be visible
            // CodeMirror is buggy if you instantiate it in a not-visible element
            // So we initialize it here instead of the init() routine
            if (inventorySourceData.source === 'ec2' || inventorySourceData.source === 'openstack' ||
                inventorySourceData.source === 'custom' || inventorySourceData.source === 'vmware') {
                $scope[inventorySourceData.source + '_variables'] = inventorySourceData.source_vars === null || inventorySourceData.source_vars === '' ? '---' : ParseVariableString(inventorySourceData.source_vars);
                ParseTypeChange({
                    scope: $scope,
                    field_id: inventorySourceData.source + '_variables',
                    variable: inventorySourceData.source + '_variables',
                    parse_variable: 'envParseType',
                });
            }
        }

        function initRegionData() {
            var source = $scope.source.value === 'azure_rm' ? 'azure' : $scope.source.value;
            var regions = inventorySourceData.source_regions.split(',');
            // azure_rm regions choices are keyed as "azure" in an OPTIONS request to the inventory_sources endpoint
            $scope.source_region_choices = $scope[source + '_regions'];

            // the API stores azure regions as all-lowercase strings - but the azure regions received from OPTIONS are Snake_Cased
            if (source === 'azure') {
                $scope.source_regions = _.map(regions, (region) => _.find($scope[source + '_regions'], (o) => o.value.toLowerCase() === region));
            }
            // all other regions are 1-1
            else {
                $scope.source_regions = _.map(regions, (region) => _.find($scope[source + '_regions'], (o) => o.value === region));
            }
            $scope.group_by_choices = source === 'ec2' ? $scope.ec2_group_by : null;
            if (source === 'ec2') {
                var group_by = inventorySourceData.group_by.split(',');
                $scope.group_by = _.map(group_by, (item) => _.find($scope.ec2_group_by, { value: item }));
            }
            initRegionSelect();
        }

        function initSources() {
            GetSourceTypeOptions({
                scope: $scope,
                variable: 'source_type_options',
                //callback: 'sourceTypeOptionsReady' this callback is hard-coded into GetSourceTypeOptions(), included for ref
            });
            GetChoices({
                scope: $scope,
                url: GetBasePath('inventory_sources'),
                field: 'source_regions',
                variable: 'rax_regions',
                choice_name: 'rax_region_choices',
                callback: 'choicesReadyGroup'
            });
            GetChoices({
                scope: $scope,
                url: GetBasePath('inventory_sources'),
                field: 'source_regions',
                variable: 'ec2_regions',
                choice_name: 'ec2_region_choices',
                callback: 'choicesReadyGroup'
            });
            GetChoices({
                scope: $scope,
                url: GetBasePath('inventory_sources'),
                field: 'source_regions',
                variable: 'gce_regions',
                choice_name: 'gce_region_choices',
                callback: 'choicesReadyGroup'
            });
            GetChoices({
                scope: $scope,
                url: GetBasePath('inventory_sources'),
                field: 'source_regions',
                variable: 'azure_regions',
                choice_name: 'azure_region_choices',
                callback: 'choicesReadyGroup'
            });
            GetChoices({
                scope: $scope,
                url: GetBasePath('inventory_sources'),
                field: 'group_by',
                variable: 'ec2_group_by',
                choice_name: 'ec2_group_by_choices',
                callback: 'choicesReadyGroup'
            });
        }

        function initVerbositySelect(){
            CreateSelect2({
                element: '#inventory_source_verbosity',
                multiple: false
            });
        }

        function sync_verbosity_select2() {
            CreateSelect2({
                element:'#inventory_source_verbosity',
                multiple: false
            });
        }

        $scope.$on('choicesReadyVerbosity', function() {
            var i;
            for (i = 0; i < $scope.verbosity_options.length; i++) {
                if ($scope.verbosity_options[i].value === $scope.verbosity) {
                    $scope.verbosity = $scope.verbosity_options[i];
                }
            }

            initVerbositySelect();
        });

        $scope.$watch('verbosity', sync_verbosity_select2);

        GetChoices({
            scope: $scope,
            url: GetBasePath('inventory_sources'),
            field: 'verbosity',
            variable: 'verbosity_options',
            callback: 'choicesReadyVerbosity'
        });

        // region / source options callback
        $scope.$on('choicesReadyGroup', function() {
            if (angular.isObject($scope.source)) {
                initRegionData();
            }
        });

        $scope.$on('sourceTypeOptionsReady', function() {
            initSourceSelect();
        });
    }
];