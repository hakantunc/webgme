/*globals define, console*/
/**
 * @author nabana / https://github.com/nabana
 * @author lattmann / https://github.com/lattmann
 */

define([
    'js/Dialogs/Projects/ProjectsDialog',
    'js/Dialogs/Commit/CommitDialog',
    'js/Dialogs/ProjectRepository/ProjectRepositoryDialog'], function (
    ProjectsDialog,
    CommitDialog,
    ProjectRepositoryDialog
) {
    "use strict";

    var ProjectNavigatorController = function ($scope, gmeClient) {

        var self = this;

        self.$scope = $scope;
        self.gmeClient = gmeClient;

        // internal data representation for fast access to objects
        self.projects = {};
        self.root = {
            id: 'root',
            label: 'GME',
//            isSelected: true,
            itemClass: 'gme-root',
            menu: []
        };

        // navigation items in the navigator list
        self.navIdRoot = 0;
        self.navIdProject = 1;
        self.navIdBranch = 2;

        self.requestedSelection = null;

        self.initialize();
    };

    ProjectNavigatorController.prototype.update = function () {
        if (!this.$scope.$$phase) {
            this.$scope.$apply();
        }
    };

    ProjectNavigatorController.prototype.initialize = function () {
        var self = this,
            newProject;

        // initialize model structure for view
        self.$scope.navigator = {
            items: [],
            separator: true
        };

        if (self.gmeClient) {
            newProject = function (data) {
                var pd = new ProjectsDialog(self.gmeClient);
                pd.show();
            };

        } else {
            newProject = function (data) {
                self.dummyProjectsGenerator('New Project ' + Math.floor(Math.random() * 10000), 4);
            };
        }

        // initialize root menu
        // projects id is mandatory
        self.root.menu = [
            {
                id: 'top',
                items: [
                    {
                        id: 'newProject',
                        label: 'New project ...',
                        iconClass: 'glyphicon glyphicon-plus',
                        action: newProject,
                        actionData: {}
                    },
                    {
                        id: 'importProject',
                        label: 'Import project ...',
                        iconClass: 'glyphicon glyphicon-import',
                        action: newProject,
                        actionData: {}
                    }
                ]
            },
            {
                id: 'projects',
                label: 'Recent projects',
                totalItems: 20,
                items: [],
                showAllItems: function () {
                    console.log('Show all items...');
                }
            },
            {
                id: 'preferences',
                items: [
                    {
                        id: 'showPreferences',
                        label: 'Show preferences',
                        action: function () {
                            console.log('Show preferences');
                        },
                        menu: [
                            {
                                items: [
                                    {
                                        id: 'preferences 1',
                                        label: 'Preferences 1'
                                    },
                                    {
                                        id: 'preferences 2',
                                        label: 'Preferences 2'
                                    },
                                    {
                                        id: 'preferences 3',
                                        label: 'Preferences 3',
                                        menu: [
                                            {
                                                items: [
                                                    {
                                                        id: 'sub_preferences 1',
                                                        label: 'Sub preferences 1'
                                                    },
                                                    {
                                                        id: 'sub_preferences 2',
                                                        label: 'Sub preferences 2'
                                                    }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                ]

            }
        ];

        if (self.gmeClient) {
            self.initWithClient();
        } else {
            self.initTestData();
        }

        // only root is selected by default
        self.$scope.navigator = {
            items: [
                self.root
            ],
            separator: true
        };
    };

    ProjectNavigatorController.prototype.initTestData = function () {
        var self = this;

        self.dummyProjectsGenerator('Project', 20);
    };

    ProjectNavigatorController.prototype.initWithClient = function () {
        var self = this;

        // register all event listeners on gmeClient

        self.gmeClient.addEventListener(self.gmeClient.events.NETWORKSTATUS_CHANGED, function (client) {
            if (self.gmeClient.getActualNetworkStatus() === self.gmeClient.networkStates.CONNECTED) {
                // get project list
                self.updateProjectList();
            } else {
                // get project list
                console.warn(self.gmeClient.getActualNetworkStatus() + " network status is not handled yet.");
            }

        });

        self.gmeClient.addEventListener(self.gmeClient.events.PROJECT_OPENED, function (client, projectId) {
            //console.log(self.gmeClient.events.PROJECT_OPENED, projectId);
            self.selectProject({projectId: projectId});
        });

        self.gmeClient.addEventListener(self.gmeClient.events.PROJECT_CLOSED, function (client, projectId) {
//            console.log(self.gmeClient.events.PROJECT_CLOSED, projectId);
            self.selectProject({});
        });

        self.gmeClient.addEventListener(self.gmeClient.events.SERVER_PROJECT_CREATED, function (client, projectId) {
//            console.log(self.gmeClient.events.SERVER_PROJECT_CREATED, projectId);
            self.addProject(projectId);
        });

        self.gmeClient.addEventListener(self.gmeClient.events.SERVER_PROJECT_DELETED, function (client, projectId) {
//            console.log(self.gmeClient.events.SERVER_PROJECT_DELETED, projectId);
            self.removeProject(projectId);
        });

        self.gmeClient.addEventListener(self.gmeClient.events.BRANCH_CHANGED, function (client, branchId) {
//            console.log(self.gmeClient.events.BRANCH_CHANGED, branchId);
            self.selectBranch({projectId: self.gmeClient.getActiveProjectName(), branchId: branchId});
        });

        self.gmeClient.addEventListener(self.gmeClient.events.SERVER_BRANCH_CREATED, function (client, parameters) {
//            console.log(self.gmeClient.events.SERVER_BRANCH_CREATED, parameters);
            self.addBranch(parameters.project, parameters.branch, parameters.commit);
        });

        self.gmeClient.addEventListener(self.gmeClient.events.SERVER_BRANCH_UPDATED, function (client, parameters) {
//            console.log(self.gmeClient.events.SERVER_BRANCH_UPDATED, parameters);
            // TODO: update branch information
            var currentProject = self.$scope.navigator.items[self.navIdProject],
                currentBranch = self.$scope.navigator.items[self.navIdBranch];

            if (currentProject) {
                currentProject = currentProject.id;
            }

            if (currentBranch) {
                currentBranch = currentBranch.id;
            }

            self.removeBranch(parameters.project, parameters.branch);
            self.addBranch(parameters.project, parameters.branch, parameters.commit);

            if (currentProject === parameters.project && currentBranch === parameters.branch) {
                //we also have te re-select the branch
                self.selectBranch({
                    projectId: currentProject,
                    branchId: currentBranch
                });
            }
        });

        self.gmeClient.addEventListener(self.gmeClient.events.SERVER_BRANCH_DELETED, function (client, parameters) {
            //console.log(self.gmeClient.events.SERVER_BRANCH_DELETED, parameters);
            self.removeBranch(parameters.project, parameters.branch);
        });

    };

    ProjectNavigatorController.prototype.updateProjectList = function () {
        var self = this;

        // FIXME: get read=only/viewable/available project?!
        self.gmeClient.getFullProjectsInfoAsync(function(err, projectList) {
            var projectId,
                branchId;

            if (err) {
                console.error(err);
                return;
            }

            // clear project list
            self.projects = {};

            for (projectId in projectList) {
                if (projectList.hasOwnProperty(projectId)) {
                    self.addProject(projectId, projectList[projectId].rights);
                    for (branchId in projectList[projectId].branches) {
                        if (projectList[projectId].branches.hasOwnProperty(branchId)) {
                            self.addBranch(projectId, branchId, projectList[projectId].branches[branchId]);
                        }
                    }
                }
            }

            if (self.requestedSelection) {
                self.selectBranch(self.requestedSelection);
                self.requestedSelection = null;
            }
        });
    };

    ProjectNavigatorController.prototype.addProject = function (projectId, rights) {
        var self = this,
            i,
            showHistory,
            showAllBranches,
            deleteProject,
            selectProject;

        rights = rights || {
            'delete': true,
            'read': true,
            'write': true
        };

        if (self.gmeClient) {
            showHistory = function (data) {
                var prd;
                if (self.gmeClient.getActiveProjectName() === data.projectId) {
                    prd = new ProjectRepositoryDialog(self.gmeClient);
                    prd.show();
                } else {
                    self.selectProject({projectId: projectId}, function (err) {
                        if (err) {
                            // TODO: handle errors
                            return;
                        }

                        var dialog = new ProjectRepositoryDialog(self.gmeClient);
                        dialog.show();
                    });
                }
            };

            deleteProject =  function (data) {
                self.gmeClient.deleteProjectAsync(data.projectId, function (err) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                });
            };

            showAllBranches = function (data) {
                console.error('showAllBranches: gmeClient version is not implemented yet.', data);
            };
        } else {
            // test version
            showHistory = function (data) {
                console.log('showHistory: ', data);
            };

            deleteProject =  function (data) {
                self.removeProject(data.projectId);
            };

            showAllBranches = function (data) {
                console.log('showAllBranches: ', data);
            };
        }

        selectProject = function (data) {
            self.selectProject(data);
        };

        // create a new project object
        self.projects[projectId] = {
            id: projectId,
            label: projectId,
            iconClass: rights.write ? '' : 'glyphicon glyphicon-lock',
            iconPullRight: !rights.write,
            disabled: !rights.read,
            isSelected: false,
            branches: {},
            action: selectProject,
            actionData: {
                projectId: projectId
            },
            menu: [
                {
                    id: 'top',
                    items: [
                        {
                            id: 'deleteProject',
                            label: 'Delete project',
                            iconClass: 'glyphicon glyphicon-remove',
                            disabled: !rights.delete,
                            action: deleteProject,
                            actionData: {
                                projectId: projectId
                            }
                        },
                        {
                            id: 'showHistory',
                            label: 'Show history',
                            iconClass: 'glyphicon glyphicon-time',
                            disabled: !rights.read,
                            action: showHistory,
                            actionData: {
                                projectId: projectId
                            }
                        }

                    ]
                },
                {
                    id: 'branches',
                    label: 'Recent branches',
                    totalItems: 20,
                    items: []
//                    showAllItems: showAllBranches
                }
            ]
        };

        if (self.gmeClient) {
            // branches are updated based on events
        } else {
            self.dummyBranchGenerator('Branch', 10, projectId);
        }

        for (i = 0; i < self.root.menu.length; i += 1) {

            // find the projects id in the menu items
            if (self.root.menu[i].id === 'projects') {

                // convert indexed projects to an array
                self.root.menu[i].items = self.mapToArray(self.projects, ['name', 'id']);
                break;
            }
        }

        self.update();
    };

    ProjectNavigatorController.prototype.addBranch = function (projectId, branchId, branchInfo) {
        var self = this,
            i,
            selectBranch,
            exportBranch,
            createBranch,
            deleteBranch,
            createCommitMessage;

        if (self.projects[projectId].disabled) {
            // do not show any branches if the project is disabled
            return;
        }

        if (self.gmeClient) {
            exportBranch = function (data) {
                var url = self.gmeClient.getDumpURL({
                    project: data.projectId,
                    branch: data.branchId,
                    output: data.projectId + '_' + data.branchId
                });

                if (url) {
                    window.location = url;
                } else {
                    console.error('Failed to get project dump url for ', data);
                }
            };

            createBranch = function (data) {
                // TODO: get available branch name for project
                var newBranchName = data.branchId + '_copy';

                self.gmeClient.createGenericBranchAsync(data.projectId, newBranchName, data.branchInfo, function (err) {
                    if (err) {
                        console.error(err);
                        return;
                    }

                    //self.selectProject({projectId: data.projectId, branchId: data.branchId + '_copy'});
                });

            };

            deleteBranch = function (data) {
                self.gmeClient.deleteGenericBranchAsync(data.projectId, data.branchId, data.branchInfo, function (err) {
                    if (err) {
                        console.error(err);
                        return;
                    }
                });
            };

            createCommitMessage = function (data) {
                self.selectBranch(data, function (err) {
                    var cd;

                    if (err) {
                       // TODO: log error
                       return;
                    }

                    cd = new CommitDialog(self.gmeClient);
                    cd.show();
                });
            };
        } else {
            // test version
            exportBranch = function (data) {
                console.log('exportBranch: ', data);
            };

            createBranch = function (data) {
                console.log('createBranch: ', data);
                self.addBranch(data.projectId, data.branchId + ' _copy');
                self.selectProject({projectId: data.projectId, branchId: data.branchId + '_copy'});
            };

            deleteBranch = function (data) {
                self.removeBranch(data.projectId, data.branchId);
                self.selectProject(data);
            };

            createCommitMessage = function (data) {
                console.log('createCommitMessage: ', data);
            };
        }

        selectBranch = function (data) {
            self.selectBranch(data);
        };

        // create the new branch structure
        self.projects[projectId].branches[branchId] = {
            id: branchId,
            label: branchId,
            properties: {
                hashTag: branchInfo || '#1234567890',
                lastCommiter: 'petike',
                lastCommitTime: new Date()
            },
            isSelected: false,
            action: selectBranch,
            actionData: {
                projectId: projectId,
                branchId: branchId
            },
            //itemTemplate: 'branch-selector-template',
            menu: [
                {
                    items: [
                        {
                            id: 'createBranch',
                            label: 'Create branch',
                            iconClass: 'glyphicon glyphicon-plus',
//                            disabled: true,
                            action: createBranch,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId,
                                branchInfo: branchInfo
                            }
                        },
                        {
                            id: 'deleteBranch',
                            label: 'Delete branch',
                            iconClass: 'glyphicon glyphicon-remove',
//                            disabled: true,
                            action: deleteBranch,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId,
                                branchInfo: branchInfo
                            }
                        },
                        {
                            id: 'exportBranch',
                            label: 'Export branch',
                            iconClass: 'glyphicon glyphicon-export',
                            action: exportBranch,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId
                            }
                        },
                        {
                            id: 'createCommitMessage',
                            label: 'Create commit message',
                            iconClass: 'glyphicon glyphicon-tag',
                            action: createCommitMessage,
                            actionData: {
                                projectId: projectId,
                                branchId: branchId
                            }
                        }
                    ]

                }
            ]
        };

        for (i = 0; i < self.projects[projectId].menu.length; i += 1) {

            // find the branches id in the menu items
            if (self.projects[projectId].menu[i].id === 'branches') {

                // convert indexed branches to an array
                self.projects[projectId].menu[i].items = self.mapToArray(self.projects[projectId].branches, ['name', 'id']);
                break;
            }
        }

        self.update();
    };

    ProjectNavigatorController.prototype.removeProject = function (projectId, callback) {
        var self = this,
            i;

        if (self.projects.hasOwnProperty(projectId)) {
            delete self.projects[projectId];

            for (i = 0; i < self.root.menu.length; i += 1) {

                // find the projects id in the menu items
                if (self.root.menu[i].id === 'projects') {

                    // convert indexed projects to an array
                    self.root.menu[i].items = self.mapToArray(self.projects);
                    break;
                }
            }

            self.selectProject({});

            self.update();
        }
    };

    ProjectNavigatorController.prototype.removeBranch = function (projectId, branchId) {
        var self = this,
            i;

        if (self.projects.hasOwnProperty(projectId) && self.projects[projectId].branches.hasOwnProperty(branchId)) {
            delete self.projects[projectId].branches[branchId];

            for (i = 0; i < self.projects[projectId].menu.length; i += 1) {

                // find the branches id in the menu items
                if (self.projects[projectId].menu[i].id === 'branches') {

                    // convert indexed branches to an array
                    self.projects[projectId].menu[i].items = self.mapToArray(self.projects[projectId].branches);
                    break;
                }
            }

            self.selectProject({projectId: projectId});

            self.update();
        }
    };

    ProjectNavigatorController.prototype.selectProject = function (data, callback) {
        this.selectBranch(data, callback);
    };

    ProjectNavigatorController.prototype.selectBranch = function (data, callback) {
        var self = this,
            projectId = data.projectId,
            branchId = data.branchId,
            currentProject = self.$scope.navigator.items[self.navIdProject],
            currentBranch = self.$scope.navigator.items[self.navIdBranch];

        callback = callback || function () {};

        // clear current selection
        if (currentProject) {
            currentProject.isSelected = false;
        }

        if (currentBranch) {
            currentBranch.isSelected = false;
        }

        if (projectId || projectId === '') {
            if (self.projects.hasOwnProperty(projectId) === false) {
                console.error(projectId + ' does not exist in the navigation bar');
                self.requestedSelection = data;
                return;
            }

            if (self.projects[projectId].disabled) {
                // prevent to select disabled projects

                if (currentProject) {
                    currentProject.isSelected = true;
                }

                if (currentBranch) {
                    currentBranch.isSelected = true;
                }

                return;
            }

            // FIXME: what if projects do not contain projectId anymore?
            self.$scope.navigator.items[self.navIdProject] = self.projects[projectId];

            // mark project as selected
            self.projects[projectId].isSelected = true;

            if (self.gmeClient) {
                if (projectId !== self.gmeClient.getActiveProjectName()) {
                    self.gmeClient.selectProjectAsync(projectId, function (err) {
                        if (err) {
                            console.error(err);
                            callback(err);
                            return;
                        }

                        if (branchId && branchId !== self.gmeClient.getActualBranch()) {
                            self.gmeClient.selectBranchAsync(branchId, function (err) {
                                if (err) {
                                    console.error(err);
                                    callback(err);
                                    return;
                                }

                                callback(null);
                            });
                        } else {
                            callback(null);
                        }
                    });

                    // we cannot select branch if the project is not open
                    // we will get a project open event
                    return;
                }
            }

            if (branchId || branchId === '') {

                if (self.projects[projectId].branches.hasOwnProperty(branchId) === false) {
                    console.error(projectId + ' - ' + branchId + ' branch does not exist in the navigation bar');
                    self.requestedSelection = data;
                    return;
                }

                // set selected branch
                self.$scope.navigator.items[self.navIdBranch] = self.projects[projectId].branches[branchId];

                // mark branch as selected
                self.projects[projectId].branches[branchId].isSelected = true;

                if (self.gmeClient) {
                    if (branchId !== self.gmeClient.getActualBranch()) {
                        self.gmeClient.selectBranchAsync(branchId, function (err) {
                            if (err) {
                                console.error(err);
                                callback(err);
                                return;
                            }

                            callback(null);
                        });

                        // we will get a branch status changed event
                        return;
                    }
                }
            } else {
                // remove branch element
                self.$scope.navigator.items.splice(self.navIdBranch, 1);
            }
        } else {
            // remove project and branch elements
            self.$scope.navigator.items.splice(self.navIdProject, 2);
        }

        callback(null);
        self.update();
    };

    ProjectNavigatorController.prototype.dummyProjectsGenerator = function (name, maxCount) {
        var self = this,
            i,
            id,
            count,
            rights;

        count = Math.max(Math.round(Math.random() * maxCount), 3);

        for (i = 0; i < count; i += 1) {
            id = name + '_' + i;
            rights = {
                'read': Math.random() > 0.2,
                'write': false,
                'delete': false,
            };

            if (rights.read) {
                rights.write = Math.random() > 0.3;
                if (rights.write) {
                    rights.delete = Math.random() > 0.3;
                }
            }

            self.addProject(id, rights);
        }
    };


    ProjectNavigatorController.prototype.dummyBranchGenerator = function (name, maxCount, projectId) {
        var self = this,
            i,
            id,
            count;

        count = Math.max(Math.round(Math.random() * maxCount), 3);

        for (i = 0; i < count; i += 1) {
            id = name + '_' + i;
            self.addBranch(projectId, id);
        }
    };

    ProjectNavigatorController.prototype.mapToArray = function (hashMap, orderBy) {
        var keys = Object.keys(hashMap),
            values = keys.map(function (v) { return hashMap[v]; });

        // keys precedence to order
        orderBy = orderBy || [];

        values.sort(function (a, b) {
            var i,
                key;

            for (i = 0; i < orderBy.length; i += 1) {
                key = orderBy[i];
                if (a.hasOwnProperty(key) && b.hasOwnProperty(key)) {
                    if (a[key] > b[key]) {
                        return 1;
                    }
                    if (a[key] < b[key]) {
                        return -1;
                    }
                }
            }

            // a must be equal to b
            return 0;
        });

        return values;
    };

    return ProjectNavigatorController;
});
