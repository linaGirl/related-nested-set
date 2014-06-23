

        /*
         * add a new item to the nested set
         */
        , _insertIntoNestedSet: function(transaction, callback) {
            this._prepareNestedSetTransaction(transaction, function(err, options) {
                var wait;

                if (err) callback(err);
                else if (!options) callback();
                else {
                    wait = async.waiter(callback);


                    // check where to place the new node
                    if (this._nestedSetConfig.parentNode === true) {
                        // new root node
                        if (this._nestedSetConfig.asLastNode && options.newNode) this[options.left] = options.newNode[options.right] + 1;
                        else this[options.left] = 1;
                    }
                    else if (this._nestedSetConfig.parentNode) {
                        // as child into a parentnode
                        if (!options.newNode) return callback(new Error('Failed to retreive the target node for the nested set «'+this.getEntityName()+'»!'));
                        else if (this._nestedSetConfig.asLastNode) this[options.left] = options.newNode[options.right]-2;
                        else this[options.left] = options.newNode[options.left]+1;
                    }
                    else {
                        // somewhere after or before another node
                        if (this._nestedSetConfig.beforeNewNode) this[options.left] = options.newNode[options.left]-2;
                        else this[options.left] = options.newNode[options.right]+1;                      
                    }
                    // set right position
                    this[options.right] = this[options.left]+1;
                    //log.wtf(this.name, this[options.left], this[options.right]);
                    //if (options.newNode) options.newNode.dir();

                    // move all items to the right 
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(this._nestedSetConfig.filter), options.left, ORM.gte(this[options.left]))).update(this._buildObject(options.left, ORM.increaseBy(2)), wait(), options.transaction);
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(this._nestedSetConfig.filter), options.right, ORM.gte(this[options.left]))).update(this._buildObject(options.right, ORM.increaseBy(2)), wait(), options.transaction);
                }
            }.bind(this));
        }


        /*
         * update nested set stuff after the model was saved
         * this must be run in a separate transaction since 
         * mysql isn't all too flexible with table locking (it sucks)
         */
        , _updateNestedSet: function(transaction, callback) { log.wtf('möving');
            this._prepareNestedSetTransaction(transaction, function(err, options) { log(options);
                var   moveValues        = {}
                    , width
                    , filter
                    , moveFilter
                    , distance
                    , tempLeftPosition
                    , newLeftPosition
                    , wait;

                if (err) callback(err);
                else if (!options) callback();
                else {
                    width             = this[options.right] - this[options.left] + 1;
                    filter            = this._nestedSetConfig.filter;
                    moveFilter        = clone(filter);
                    
                    // when all element are moved we shoudl set our new position
                    wait = async.waiter(callback);

                    // get the new left position
                    if (this._nestedSetConfig.parentNode === true) {
                        // new root node
                        if (this._nestedSetConfig.asLastNode && options.newNode) newLeftPosition = options.newNode[options.right] + 1;
                        else newLeftPosition = 1;
                    }
                    else if (this._nestedSetConfig.parentNode) {
                        // as child of a parentnode
                        if (!options.newNode) return callback(new Error('Failed to retreive the target node for the nested set «'+this.getEntityName()+'»!'));
                        else if (this._nestedSetConfig.asLastNode) newLeftPosition = options.newNode[options.right]-width;
                        else newLeftPosition = options.newNode[options.left]+1;
                    }
                    else {
                        // somewhere after or before another node
                        if (this._nestedSetConfig.beforeNewNode) newLeftPosition = options.newNode[options.left]-width;
                        else newLeftPosition = options.newNode[options.right]+1;                      
                    }

                    // position calculations
                    distance            = newLeftPosition - this[options.left];
                    tempLeftPosition    = this[options.left];

                    if (distance < 0) {
                        distance            -= width;
                        tempLeftPosition    += width;
                    }


                    // create new space for subtree
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(filter), options.left, ORM.gte(newLeftPosition))).update(this._buildObject(options.left, ORM.increaseBy(width)), wait(), options.transaction);
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(filter), options.right, ORM.gte(newLeftPosition))).update(this._buildObject(options.right, ORM.increaseBy(width)), wait(), options.transaction);

                    // move subtree into new space
                    this._mergeNestedSetFilter(moveFilter, options.left, ORM.gte(tempLeftPosition));
                    this._mergeNestedSetFilter(moveFilter, options.right, ORM.lt(tempLeftPosition+width));
                    moveValues[options.left] = ORM.increaseBy(distance);
                    moveValues[options.right] = ORM.increaseBy(distance);
                    this._orm[options.databaseName][options.entityName](moveFilter).update(moveValues, wait(), options.transaction);

                    // remove old space vacated by subtree
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(filter), options.left, ORM.gt(this[options.right]))).update(this._buildObject(options.left, ORM.decreaseBy(width)), wait(), options.transaction);
                    this._orm[options.databaseName][options.entityName](this._mergeNestedSetFilter(clone(filter), options.right, ORM.gt(this[options.right]))).update(this._buildObject(options.right, ORM.decreaseBy(width)), wait(), options.transaction);
                }
            }.bind(this));
        }



        /*
         * prepare everything required for executing a nested set operation
         */
        , _prepareNestedSetTransaction: function(transaction, callback) {
            var   databaseName
                , entityName;

            if (this._defintion.isNestedSet && this._nestedSetConfig && (this._nestedSetConfig.parentNode || this._nestedSetConfig.referenceNode)) {
                databaseName    = this._defintion.getDatabaseName();
                entityName      = this.getEntityName();

                // lock the table, so we're not going to have conflicts
                transaction.lock(this.getEntityName(), transaction.LOCK_EXCLUSIVE, function(err) {
                    if (err) callback(err);
                    else {
                        this._getNestedSetTargetNode((this._nestedSetConfig.parentNode || this._nestedSetConfig.referenceNode), transaction, databaseName, entityName, function(err, newNode) {
                            if (err) callback(err);
                            else {
                                callback(null, {
                                      transaction   : transaction
                                    , newNode       : newNode
                                    , left          : this._defintion.nestedSetLeft
                                    , right         : this._defintion.nestedSetRight
                                    , databaseName  : databaseName
                                    , entityName    : entityName
                                });
                            }
                        }.bind(this));
                    }
                }.bind(this));
            }
            else callback();
        }


        /*
         * creates an object from a propertyname and value
         */
        , _buildObject: function(property, value) {
            var obj = {};
            obj[property] = value;
            return obj;
        }


        /*
         * creates a copy of an exisitng filter, merges new 
         * values into it, based on the current model
         */
        , _mergeNestedSetFilter: function(filter, key, value) {
            if (!filter) filter = {};
            filter[key] = value;
            return filter;
        }


        /*
         * get the node targeted in the update of the nested set
         */
        , _getNestedSetTargetNode: function(node, transaction, databaseName, entityName, callback) {
            var   filter
                , query;

            if (type.number(node)) {
                filter = {};

                if (this._defintion.primaryKeys.length > 1) throw new Error('Cannot load nested set node on model «'+this.getEntityName()+'» with more than one primarykey, please report a feature request @github ;)');
                filter[this._defintion.primaryKeys[0]] = node;

                this._orm[databaseName][entityName](filter).findOne(function(err, newNode) {
                    if (err) callback(err);
                    else if (!newNode) callback(new Error('Nested set «'+this.getEntityName()+'» failed to load new parent / prior node'));
                    else callback(null, newNode);
                }.bind(this));
            }
            else if (type.boolean(node) && node === true) {
                // if we're adding the new roto node at the end we have to get the ast node of the tree
                if (this._nestedSetConfig.asLastNode) {
                    query = new Query({filter: this._nestedSetConfig.filter});
                    query.resetOrder().order.push({
                          property  : left
                        , desc      : !true
                        , priority  : 0
                    }).offset(null).limit(1);
                    transaction.executeQuery('query', query, callback);
                }
                else callback();
            }
            else if (type.object(node) && type.function(node.isQuery) && node.isQuery()) node.findOne(callback);
            else node.reload(callback, transaction);
        }
