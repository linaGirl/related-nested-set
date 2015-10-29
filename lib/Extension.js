!function() {
    'use strict';


    var   Class         = require('ee-class')
        , log           = require('ee-log')
        , type          = require('ee-types')
        , async         = require('ee-async')
        , asyncMethod   = require('async-method')
        , ORMExtension  = require('related-extension');


    var thisContext;


    module.exports = new Class({
        inherits: ORMExtension

        , left:     'left'
        , right:    'right'
        , _name:    'nested-set'


        , init: function init(options) {
            init.super.call(this);

            // store this context so we'll have acces in some
            // methods attached to the model
            thisContext = this;

            if (options) {
                if (options.left)   this.left           = options.left;
                if (options.right)  this.right          = options.right;
            }

            // storage for model specific configurations
            Class.define(this, '_configuration', Class({}));

            // check for grouping key, they can be used if
            // you are going to store multiple trees inside
            // a single table
            if (options) {
                Object.keys(options).forEach(function(databaseName) {
                    if (databaseName !== 'left' && databaseName !== 'right') {
                        if (!this._configuration[databaseName]) this._configuration[databaseName] = {};

                        // loop trough tables
                        Object.keys(options[databaseName]).forEach(function(modelName) {
                            this._configuration[databaseName][modelName] = options[databaseName][modelName];
                        }.bind(this));
                    }
                }.bind(this));
            }
        }



        /*
         * set group key for a specifc model
         **/
        , setGroupKey: function(databaseName, modelName, keyName) {
            if (!this._configuration[databaseName]) this._configuration[databaseName] = {};
            this._configuration[databaseName][modelName] = keyName;
        }





        /*
         * event listener for the model beforeUpdate event, will
         * called by all models which this extension is applied to
         */
        , onBeforeUpdate: function(model, transaction, query, callback) {
            var groupKey;

            if (model.disableNestedSetExtension) return callback();

            if (model._changedValues.indexOf(this.right) >= 0 || model._changedValues.indexOf(this.left) >= 0) return callback(new Error('Please dont set the nested set internal properties «'+this.left+'» or «'+this.right+'» manually!'));

            if (model._nestedSet) {
                groupKey = this.getGroupKey(model);

                if (groupKey && model._changedValues.indexOf(groupKey) >= 0 && (type.null(model[groupKey]) || type.undefined(model[groupKey]))) {
                    return callback(new Error('Cannot update the «'+model.getEntityName()+'» model because the groupKey is missing, did you forget to select the groupKey?'));
                }

                // we need to load the model from the db in order to be able to
                // compare the current group with the new value. if the group has
                // changed we need to remove the model from the currrent tree and
                // insert it as new node into the other tree

                this.orm[model.getDefinition().getDatabaseName()][model.getEntityName()](model.getPrimaryKeyFilter(), ['*']).findOne(function(err, dbModel) {
                    if (err) callback(err);
                    else if (!dbModel) callback(new Error('Failed to load the nested set model from the database!'))
                    else {


                        // a normal update
                        // compute new position
                        this._repositionModel(model, transaction, function(err, options) {
                            if (err) callback(err);
                            else {
                                var   ORM           = this.orm.getORM()
                                    , distance      = model[this.left] - options.left
                                    , direction     = distance < 0 ? -1 : 1
                                    , difference    = direction >= 0 ? 0 : options.width;


                                // create new space for the subtree
                                this._executeQuery(model, this.getGroupedFilter(model, [{
                                      key       : this.left
                                    , value     : ORM.gte(model[this.left])
                                }]), [{
                                      key       : this.left
                                    , value     : ORM.increaseBy(options.width)
                                }], transaction).then(function() {
                                    return this._executeQuery(model, this.getGroupedFilter(model, [{
                                          key       : this.right
                                        , value     : ORM.gte(model[this.left])
                                    }]), [{
                                          key       : this.right
                                        , value     : ORM.increaseBy(options.width)
                                    }], transaction);
                                }.bind(this)).then(function() {

                                    // move subtree into new space
                                    if (groupKey && model[groupKey] != dbModel[groupKey]) {
                                        return this._executeQuery(model, this.getGroupedFilter(dbModel, [{
                                              key       : this.left
                                            , value     : ORM.gte(dbModel[this.left])
                                        }, {
                                              key       : this.right
                                            , value     : ORM.lte(dbModel[this.right])
                                        }]), [{
                                              key       : this.left
                                            , value     : ORM.increaseBy(distance)
                                        }, {
                                              key       : this.right
                                            , value     : ORM.increaseBy(distance)
                                        }, {
                                              key       : groupKey
                                            , value     : model[groupKey]
                                        }], transaction);
                                    }
                                    else {
                                        return this._executeQuery(model, this.getGroupedFilter(model, [{
                                              key       : this.left
                                            , value     : ORM.gte(options.left+difference)
                                        }, {
                                              key       : this.right
                                            , value     : ORM.lt(options.left+difference+options.width)
                                        }]), [{
                                              key       : this.left
                                            , value     : ORM.increaseBy(distance+difference*direction)
                                        }, {
                                              key       : this.right
                                            , value     : ORM.increaseBy(distance+difference*direction)
                                        }], transaction);
                                    }
                                }.bind(this)).then(function() {

                                    // update the groupkey on the subtree if it has changed
                                    return Promise.resolve();
                                }.bind(this)).then(function() {

                                    // remove old vacated sapce
                                    return this._executeQuery(model, this.getGroupedFilter(dbModel, [{
                                          key       : this.left
                                        , value     : ORM.gt(options.left)
                                    }]), [{
                                          key       : this.left
                                        , value     : ORM.decreaseBy(options.width)
                                    }], transaction);
                                }.bind(this)).then(function() {

                                    return this._executeQuery(model, this.getGroupedFilter(dbModel, [{
                                          key       : this.right
                                        , value     : ORM.gt(options.right)
                                    }]), [{
                                          key       : this.right
                                        , value     : ORM.decreaseBy(options.width)
                                    }], transaction);
                                }.bind(this)).then(function() {

                                    // remove from changed values
                                    model._changedValues.splice(model._changedValues.indexOf(this.left), 1);
                                    model._changedValues.splice(model._changedValues.indexOf(this.right), 1);

                                    // remove mover instructions, mark as done
                                    delete model._nestedSet;

                                    callback();
                                }.bind(this)).catch(callback);
                            }
                        }.bind(this));
                    }
                }.bind(this));
            }
            else callback();
         }



         /**
          * add group key to filters
          */
         , getGroupedFilter: function(model, filters) {
             var groupKey = this.getGroupKey(model);

             if (groupKey) {
                 filters.push({
                       key: groupKey
                     , value: model[groupKey]
                 });
             }

             return filters;
         }



        /*
         * event listener for the model beforeInsert event, will
         * called by all models which this extension is applied to
         */
        , onBeforeInsert: function(model, transaction, callback, width) {
            var groupKeyName;

            if (model.disableNestedSetExtension) return callback();

            if (model._changedValues.indexOf(this.right) >= 0 || model._changedValues.indexOf(this.left) >= 0) return callback(new Error('Please dont set the nested set internal properties «'+this.left+'» or «'+this.right+'» manually!'));

            if (model._nestedSet) {

                // lock table in order to remain consistent
                this._lock(model, transaction);

                // check if the entries in this table are grouped (multiple trees in one table)
                if (thisContext.hasGroupKey(model)) {
                    groupKeyName = thisContext.getGroupKey(model);
                    if (!model[groupKeyName]) return callback(new Error('Cannot save model, missing grouping key for the nesting set «'+model.getEntityName()+'»!'));
                }

                // compute new position
                this._repositionModel(model, transaction, function(err, options) {
                    if (err) callback(err);
                    else {

                        // move nodes to the right to get a gap
                        this._moveToRight(transaction, model, width, function(err) {
                            if (!err) delete model._nestedSet;
                            callback(err);
                        }.bind(this));
                    }
                }.bind(this));
            }
            else callback(new Error('No node position defined for the nested set on the model «'+model.getEntityName()+'». Please define one via the setParent, after or the before method.'));
        }



        /**
         * moves models to the rigth after an insert action
         */
        , _moveToRight: function(transaction, model, width, callback) {
            var   ORM  = this.orm.getORM()
                , wait;

            wait = async.waiter(callback);

            // move all nodes to the right
            this._executeQuery(model, this.getGroupedFilter(model, [{
                  key       : this.left
                , value     : ORM.gte(model[this.left])
            }]), [{
                  key       : this.left
                , value     : ORM.increaseBy(width || 2)
            }], transaction, wait());

            this._executeQuery(model, this.getGroupedFilter(model, [{
                  key       : this.right
                , value     : ORM.gte(model[this.left])
            }]), [{
                  key       : this.right
                , value     : ORM.increaseBy(width || 2)
            }], transaction, wait());
        }




        /*
         * event listener for the model beforeDelete event, will
         * called by all models which this extension is applied to
         */
        , onBeforeDelete: function(model, transaction, callback) {
            if (model.disableNestedSetExtension) return callback();

            if (model._changedValues.indexOf(this.right) >= 0 || model._changedValues.indexOf(this.left) >= 0) return callback(new Error('Please dont set the nested set internal properties «'+this.left+'» or «'+this.right+'» manually!'));

            model.reload(function(err) {
                if (err) callback(err);
                else {
                    if (model[this.right]-model[this.left] > 1) callback(new Error('Cannot delete the model «'+model.getEntityName()+'». The nested set node has children, please delete or mode the children before deleeting the model.'));
                    else callback();
                }
            }.bind(this), transaction);
        }


        /*
         * event listener for the model afterDelete event, will
         * called by all models which this extension is applied to
         */
        , onAfterDelete: function(model, transaction, callback, width) {

            if (model.disableNestedSetExtension) return callback();

            this._lock(model, transaction);

            var   ORM  = this.orm.getORM()
                , wait;

            wait = async.waiter(function(err) {
                if (!err) delete model._nestedSet;
                callback(err);
            }.bind(this));

             // move all nodes to the left
            this._executeQuery(model, this.getGroupedFilter(model, [{
                  key       : this.left
                , value     : ORM.gte(model[this.left])
            }]), [{
                  key       : this.left
                , value     : ORM.decreaseBy(width || 2)
            }], transaction, wait());

            this._executeQuery(model, this.getGroupedFilter(model, [{
                  key       : this.right
                , value     : ORM.gte(model[this.left])
            }]), [{
                  key       : this.right
                , value     : ORM.decreaseBy(width || 2)
            }], transaction, wait());
        }





        /**
         * finds the groupkey value in a tree
         */
        , getGroupKeyFromTree: function(groupKeyName, subTree) {
            if (subTree) {
                for (var i = 0, l = subTree.length; i < l; i++) {
                    if (subTree[i][groupKeyName]) {
                        return subTree[i][groupKeyName];
                    }
                    else if (subTree[i].children && subTree[i].children.length) {
                        return this.getGroupKeyFromTree(groupKeyName, subTree[i].children);
                    }
                }
            }
        }



        /**
         * checks if a given cnotext has a grouping key
         */
        , hasGroupKey: function(context) {
            return !!this.getGroupKey(context);
        }



        /**
         * checks if a given cnotext has a grouping key
         */
        , getGroupKey: function(context) {
            var   isModel      = context.isModel && context.isModel()
                , definition   = isModel ? context.getDefinition():   context.getdefinition()
                , databaseName = definition.databaseName
                , entityName   = isModel ? context.getEntityName():   context.getentityName();


            if (this._configuration[databaseName] &&
                this._configuration[databaseName][entityName]) {
                return this._configuration[databaseName][entityName];
            }
            return null;
        }


        /**
         * sync a tree structure with the db, remove
         * removed records, add new ones and rebuild
         * the tree in the table. returnes the rebuilt
         * tree
         */
        , syncTree: asyncMethod(function(tree, callback) {
            var   transaction   = this._getDatabase().createTransaction()
                , entityName    = this.getentityName()
                , definition    = this.getdefinition()
                , primaries     = definition.primaryKeys
                , Model         = this._getDatabase()[entityName]
                , left          = thisContext.left
                , right         = thisContext.right
                , pseudoModel   = {}
                , filter
                , groupKey
                , groupKeyName;



            // check if we got different trees in one table
            if (thisContext.hasGroupKey(this)) {
                groupKeyName = thisContext.getGroupKey(this);

                groupKey = thisContext.getGroupKeyFromTree(groupKeyName, tree);

                // the groupkey is not optional at all
                if (!groupKey) {
                    transaction.rollback();
                    return callback(new Error('Cannot save the tree, the group key ist missing!'));
                }
                pseudoModel[groupKeyName] = groupKey;
            }


            // create a filter to only load subtrees if there are multiple trees
            filter = thisContext._createfilter(null, definition, definition.getDatabaseName(), definition.getTableName(), null, pseudoModel);

            // lock the table so nothing gets changed during our work
            transaction.lock(entityName, transaction.LOCK_WRITE);

            // load existing dats from the db
            transaction[entityName](filter).find().then(function(rows) {
                var   map      = {}
                    , newTree  = []
                    , itemList = [];

                // try to get the value for the groupkey
                if (groupKeyName && !groupKey) {
                    if (!rows.some(function(row) {
                        if (row[groupKeyName]) {
                            groupKey = row[groupKeyName];
                            return true;
                        }
                    })) {
                        transaction.rollback();
                        return callback(new Error('Cannot save the tree, the group key ist missing!'));
                    }
                }

                // build a map of the existing entries
                rows.forEach(function(row) {
                    var id = primaries.map(function(pk) {return row[pk];}).join('|');
                    map[id] = row;
                }.bind(this));


                var walkTree = function(subTree, newSubTree, counter) {
                    subTree.forEach(function(node) {
                        var   id    = primaries.map(function(pk) {return node[pk];}).join('|')
                            , item  = map[id];


                        // do we need to create a new item?
                        if (!item) item = new Model();
                        else delete map[id];

                        // store in flat list for saving all item in one transaction
                        itemList.push(item);

                        // instruct this ectension to not to do anything on those
                        // models
                        item.disableNestedSetExtension = true;

                        // set properties, don't set pks
                        Object.keys(node).forEach(function(propertyName) {
                            // don't set primary keys
                            if (primaries.indexOf(propertyName) === -1) item[propertyName] = node[propertyName];
                        }.bind(this));

                        // set goup key
                        if (groupKeyName) item[groupKeyName] = groupKey;

                        // add to our new tree
                        newSubTree.push(item);

                        // asssign the current value
                        item[left] = ++counter;

                        // walk subtree
                        if (node.children && node.children.length) {
                            if (!item.children) item.children = [];
                            counter = walkTree(node.children, item.children, counter);
                        }

                        // set right
                        item[right] = ++counter;
                    }.bind(this));

                    return counter;
                }.bind(this);


                walkTree(tree, newTree, 0);


                // save the tree
                Promise.all(itemList.map(function(item) {
                    return item.save(transaction);
                }.bind(this))).then(function() {
                    var keys = Object.keys(map);

                    if (keys.length) {
                        return Promise.all(keys.map(function(key) {
                            map[key].disableNestedSetExtension = true;
                            return map[key].delete(transaction);
                        }.bind(this)));
                    }
                    else return Promise.resolve();
                }.bind(this)).then(function() {
                    transaction.commit(function(err) {
                        if (err) callback(err);
                        else {
                            this.loadTree(groupKey, callback);
                            //callback(null, newTree);
                        }
                    }.bind(this));
                }.bind(this)).catch(function(err) {
                    transaction.rollback();
                    callback(new Error('failed to save the tree: '+err.message));
                }.bind(this));


            }.bind(this)).catch(callback);
        })




        /*
         * return the complete tree, load it from the db
         * this method is placed on the querybuilder
         */
        , loadTree: asyncMethod(function(groupKey, callback) {
            var   definition    = this.getdefinition()
                , entityName    = this.getentityName()
                , databaseName  = definition.getDatabaseName()
                , left          = thisContext.left
                , pseudoModel   = {}
                , groupKeyName  = thisContext.getGroupKey(this)
                , filter;

            // the groupkey is optional
            if (type.function(groupKey)) {
                callback = groupKey;
                groupKey = null;
            }

            // check if we got different trees in one table
            if (groupKeyName) {
                // the groupkey is not optional at all
                if (!groupKey) return callback(new Error('Cannot load the tree, the group key ist missing!'));
                pseudoModel[groupKeyName] = groupKey;
            }

            // add groupkey filter if required
            filter = thisContext._createfilter(null, definition, databaseName, entityName, null, pseudoModel);

            // apply filter
            this.filter(filter);

            // we need at least the left 6 right values
            this.select(['*']);

            // order it correctly
            this.order(left);

            // load entries
            this.find(function(err, set) {
                if (err) callback(err);
                else {
                    var virtualParent = {};

                    // sort nodes by left asc
                    set.sort(function(a, b) {return a[left] - b[left]});

                    // build tree
                    thisContext._parseNodes(virtualParent, set);

                    // return 0-n root nodes
                    callback(null, virtualParent.children);
                }
            }.bind(this));
        })


        /*
         * build a tree from a flta set
         */
        , _parseNodes: function(parentNode, children) {
            var   right         = this.right
                , nextRight     = 0
                , nextChildren  = []
                , parent;

            if (!parentNode.children) parentNode.children = [];

            children.forEach(function(node) {
                if (node[right] > nextRight) {
                    if (nextChildren.length) this._parseNodes(parent, nextChildren);
                    // store next rigth boundary
                    nextRight = node[right];

                    // reset children array
                    nextChildren = [];

                    // add to parent
                    parentNode.children.push(node);

                    // set as parent
                    parent = node;
                }
                else nextChildren.push(node);
            }.bind(this));

            if (nextChildren.length) this._parseNodes(parent, nextChildren);
        }


        /*
         * instructs this extnesion to not to appl ysoft delete
         * runs in the context of the model
         * runs in the context of the model
         */
        , setParent: function(node, asLastChild) {
            thisContext._prepareForNestedSet(this);
            this._nestedSet.parent      = node;
            this._nestedSet.asLastChild = !!asLastChild;

            if (type.undefined(node) || type.null(node)) this._nestedSet.newRootNode = true;
            return this;
        }


        /*
         * before this node to the targetnode
         * runs in the context of the model
         */
        , before: function(targetNode) {
            thisContext._prepareForNestedSet(this);
            this._nestedSet.before = targetNode;
            return this;
        }

        /*
         * after this node after the targetnode
         * runs in the context of the model
         */
        , after: function(targetNode) {
            thisContext._prepareForNestedSet(this);
            this._nestedSet.after = targetNode;
            return this;
        }


        /*
         * returns the children from a nested set, if loaded
         * runs in the context of the model
         */
        , getChildren: function() {
            return this.children || null;
        }

        /*
         * returns parentnode if the nested set was loaded before
         * runs in the context of the model
         */
        , getParentNode: function() {
            return this.parentNode || null;
        }


        /*
         * set the new position on the model based on the input
         * collected from the model
         */
        , _repositionModel: function(model, transaction, callback) {
            if (model.disableNestedSetExtension) return callback();
            // we need an exclusive table lock for this ...
            this._lock(model, transaction);

            //need to get accurate values on my current position
            this.orm[model.getDefinition().getDatabaseName()][model.getEntityName()](model.getPrimaryKeyFilter(), ['*']).findOne(function(err, dbModel) {
                if (err) callback(err);
                else {
                    // get the target model (none, new parent, before / after)
                    this._getTargetModelInstance(model, transaction, function(err, node) {
                        var   groupKeyName;

                        if (err) callback(err);
                        else {
                            var   nestedSet = model._nestedSet
                                , options   = {};


                            options.width   = (dbModel || model)[this.right]-(dbModel || model)[this.left] + 1;
                            options.left    = (dbModel || model)[this.left];
                            options.right   = (dbModel || model)[this.right];


                            // we're ready to process this query, find the new position of this node
                            if (nestedSet.newRootNode) {
                                // we're a new root node
                                if (nestedSet.asLastChild && node) model[this.left] = node[this.right]+1;
                                else model[this.left] = 1;
                            }
                            else {
                                if (!node) return callback(new Error('Failed to load the target node for repositioning the model!'));
                                else {
                                    // we need to cneck if the model and the target are in
                                    // the same group if the nested set has a grouping key
                                    if (thisContext.hasGroupKey(model)) {
                                        groupKeyName = thisContext.getGroupKey(model);
                                        if (!model[groupKeyName]) return callback(new Error('Cannot save model, missing grouping key for the nesting set «'+model.getEntityName()+'»!'));
                                        if (model[groupKeyName] != node[groupKeyName]) return callback(new Error('Cannot save model, the model has a different group key «'+model[groupKeyName]+'» than the the targeted model «'+node[groupKeyName]+'» for the nested set «'+model.getEntityName()+'»!'));
                                    }

                                    // we have to check if we got a reference to ourselve for
                                    // repositioning
                                    if (model.getPrimaryKeys().every(function(fieldName) {
                                        return node[fieldName] == model[fieldName];
                                    })) {
                                        return callback(new Error('Cannot save model, the targeted model is the same as the model to reposition for the nesting set «'+model.getEntityName()+'»!'));
                                    }

                                    // we cannot reference a subnode of the tree to move
                                    if (node[this.left] > model[this.left] && node[this.left] < model[this.right]) {
                                        return callback(new Error('Cannot save model, the targeted model is a child of the model to move! nesting set «'+model.getEntityName()+'»'));
                                    }


                                    if (nestedSet.parent) {
                                        // new parent for this node
                                        if (nestedSet.asLastChild) model[this.left] = node[this.right]-2;
                                        else model[this.left] = node[this.left]+1;
                                    }
                                    else if (nestedSet.after) {
                                        // after after node
                                        model[this.left] = node[this.right]+1;
                                    }
                                    else if (nestedSet.before) {
                                        // before after node
                                        model[this.left] = node[this.left];
                                    }
                                }
                            }

                            // right is on insert also left+1
                            model[this.right] = model[this.left]+(options.width || 2)-1;

                            callback(null, options);
                        }
                    }.bind(this));
                }
            }.bind(this));
        }



        /*
         * apply the exclusive table lock so the
         * nested set can be updated concurrently
         */
        , _lock: function(model, transaction) {
            transaction.lock(model.getEntityName(), transaction.LOCK_WRITE);
        }


        /*
         * tries to load a model from the db when an id was provided.
         * reloads the model if a model was provided. executes a query
         * if one was provided.
         */
        , _getTargetModelInstance: function(model, transaction, callback) {
            var   databaseName
                , entityName
                , definition
                , filter
                , input;

            // find the data passed into the model
            if (model._nestedSet.parent) input = model._nestedSet.parent;
            else if (model._nestedSet.after) input = model._nestedSet.after;
            else if (model._nestedSet.before) input = model._nestedSet.before;

            if (model._nestedSet.newRootNode && model._nestedSet.asLastChild) {
                // try to get the last node
                definition      = model.getDefinition();
                databaseName    = definition.getDatabaseName();
                entityName      = model.getEntityName();
                filter          = this._createfilter(null, definition, databaseName, entityName, null, model);

                // go and find the last node
                this.orm[databaseName][entityName](filter, ['*']).order(this.right, true).findOne(callback, transaction);
            }
            else if (type.undefined(input) || type.null(input)) callback();
            else if (type.object(input) && ((type.function(input.isModel) && input.isModel()) || (type.function(input.isQuery) && input.isQuery()))) {
                if (type.function(input.isModel) && input.isModel()) input.reload(callback, transaction);
                else {
                    input.select(['*']).findOne(function(err, node) {
                        if (err) callback(err);
                        else if (!node) callback(new Error('The nested set on the model «'+model.getEntityName()+'» could not find the target node passed as a query.'));
                        else callback(null, node);
                    }.bind(this), transaction);
                }
            }
            else if(type.number(input) || type.string(input)) {
                definition      = model.getDefinition();
                filter          = {};
                databaseName    = definition.getDatabaseName();
                entityName      = definition.getTableName();

                // prepare filter
                filter = this._createfilter(input, definition, databaseName, entityName, null, model);

                // go and find the node
                this.orm[databaseName][entityName](filter, ['*']).findOne(function(err, node) {
                    if (err) callback(err);
                    else if (!node) callback(new Error('The nested set on the model «'+model.getEntityName()+'» could not find the target node using the input provided ('+input+').'));
                    else callback(null, node);
                }.bind(this), transaction);
            }
            else callback(new Error('The nested set on the model «'+model.getEntityName()+'» cannot handle the target provided. Accepting integers & strings (primary keys) or models or queries! You provided «'+type(input)+'»!'));
        }


        /*
         * execute a nested set specific query
         */
        , _executeQuery: function(model, filters, values, transaction, callback) {
            var   definition    = model.getDefinition()
                , databaseName  = definition.getDatabaseName()
                , entityName    = model.getEntityName();

            return this.orm[databaseName][entityName](this._createfilter(null, definition, databaseName, entityName, filters, model)).update(this._createObject(values), callback, transaction);
        }



        /*
         * creates an object from an array contining keys & values
         */
        , _createObject: function(list, extingObject) {
            var obj = extingObject || {};

            if(type.array(list)) {
                list.forEach(function(item) {
                    obj[item.key] = item.value;
                });
            }

            return obj;
        }



        /*
         * build a basic filter object
         */
        , _createfilter: function(primaryValue, defintion, databaseName, entityName, filters, model) {
            var   filter = {}
                , groupKey;

            // prepare filter
            if (!type.null(primaryValue) && !type.undefined(primaryValue)) {
                if (defintion.primaryKeys.length !== 1) return new Error('The nested set on the model «'+entityName+'» cannot handle lookup targets with more or less than one primary key. Please provide a model or a query instead!');
                defintion.primaryKeys.forEach(function(key) {
                    filter[key] = primaryValue;
                }.bind(this));
            }


            // maybe we have to use grouping
            if (this._configuration[databaseName] && this._configuration[databaseName][entityName] && this._configuration[databaseName][entityName]) {
                groupKey = this._configuration[databaseName][entityName];
                if (type.undefined(model[groupKey])) return new Error('The nested set on the model «'+entityName+'» cannot apply the modification requested, the current model has no value for the groupKey «'+groupKey+'» set!');
                filter[groupKey] = model[groupKey];
            }

            // add additional filters
            if(type.array(filters)) this._createObject(filters, filter);

            return filter;
        }


        /*
         * make sure the _nestedSet property is set on the model instance
         */
        , _prepareForNestedSet: function(target) {
            if (!target._neestedSet) Class.define(target, '_nestedSet', Class({}).Writable().Configurable());
        }


        /*
         * checks if this extension should be used on the current model
         * methods and properties may be installed on the models prototype
         */
        , applyModelMethods: function(definition, classDefinition) {

            // add this method to the model
            classDefinition.setParent       = this.setParent;
            classDefinition.after           = this.after;
            classDefinition.before          = this.before;
            classDefinition.getChildren     = this.getChildren;
            classDefinition.getParentNode   = this.getParentNode;

            if (!classDefinition._serialize) classDefinition._serialize = []
            classDefinition._serialize.push('children');
        }


        /*
         * checks if this extension should be used on the current querybuilder
         * methods and properties may be installed on the models prototype
         */
        , applyQueryBuilderMethods: function(definition, classDefinition) {

            // add this model to the querybuilder prototype
            classDefinition.loadTree = this.loadTree;
            classDefinition.syncTree = this.syncTree;
        }


        /*
         * checks if this extension should be applied to the
         * current model
         */
        , useOnModel: function(definition) {
            return definition.hasColumn(this.left) && definition.hasColumn(this.right);
        }
    });
}();
