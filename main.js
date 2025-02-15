function createColumn() {
  return {
    name: '',
    type: '',
    nullable: true,
    primaryKey: false,
    unique: false,
    defaultValue: ''
  };
}

function importDDL(sql) {
  let charArray = Array.from(sql);

  // 不要な空白除去
  let buf = ''
  let isSkipSpace = false;
  for (let i = 0; i < charArray.length; i++) {

    if (isSkipSpace) {
      if (charArray[i] === ' ') {
        continue;
      }

      isSkipSpace = false;
    } else if (charArray[i] === ' ' || charArray[i] === '\n') {
      isSkipSpace = true;
    }

    buf += charArray[i];
  }

  buf = buf.trim();

  const charArrayOrg = Array.from(buf);
  charArray = Array.from(buf.toUpperCase());

  //
  let parserStep = 0;
  let parserSubStep = 0;
  let isTypeSizeScan = false;
  let column = createColumn();
  let isDefaultScan = false;
  let isPrimaryKeyScan = false;
  let isCommentScan = false;
  let primaryKeyMap = new Set();
  buf = '';
  const tableInfo = {
    name: '',
    schema: '',
    columns: []
  }

  for (let i = 0; i < charArray.length; i++) {
    if (!isCommentScan && i + 1 < charArray.length && charArray[i] === '-' && charArray[i + 1] === '-') {
      isCommentScan = true;
      i += 1;
      continue;
    }

    if (isCommentScan) {
      if (charArray[i] === '\n') {
        isCommentScan = false;
      }
      continue;
    }

    if (parserStep === 0) {
      // CREATE TABLE
      if (i + 11 < charArray.length && charArray[i] === 'C' && charArray[i + 1] === 'R' && charArray[i + 2] === 'E' && charArray[i + 3] === 'A' && charArray[i + 4] === 'T' && charArray[i + 5] === 'E' && charArray[i + 6] === ' '
        && charArray[i + 7] === 'T' && charArray[i + 8] === 'A' && charArray[i + 9] === 'B' && charArray[i + 10] === 'L' && charArray[i + 11] === 'E'
      ) {
        i += 11;
        parserStep++;
        buf = '';
        continue;
      }
    } else if (parserStep === 1) {
      // Table Name
      if (charArray[i] === ' ') {
        continue;
      } else if (charArray[i] === '(') {
        parserStep++;
        if (buf.indexOf('.') !== -1) {
          const tableName = buf.split('.');
          tableInfo.schema = tableName[0].trim();
          tableInfo.name = tableName[1].trim();
        } else {
          tableInfo.name = buf.trim();
        }
        buf = '';
        parserSubStep = 0;
        continue;
      }

      buf += charArrayOrg[i];
    } else if (parserStep === 2) {
      // Columns
      if (charArray[i] === '\r' || charArray[i] === '\n') {
        continue;
      }

      if (i + 7 < charArray.length && charArray[i] === 'N' && charArray[i + 1] === 'O' && charArray[i + 2] === 'T' && charArray[i + 3] === ' ' && charArray[i + 4] === 'N' && charArray[i + 5] === 'U' && charArray[i + 6] === 'L' && charArray[i + 7] === 'L') {
        column.nullable = false;
        buf = '';
        i += 7;
        continue;
      }

      if (i + 7 < charArray.length && charArray[i] === 'D' && charArray[i + 1] === 'E' && charArray[i + 2] === 'F' && charArray[i + 3] === 'A' && charArray[i + 4] === 'U' && charArray[i + 5] === 'L' && charArray[i + 6] === 'T' && charArray[i + 7] === ' ') {
        isDefaultScan = true;
        buf = '';
        i += 7;
        continue;
      }

      if (i + 5 < charArray.length && charArray[i] === 'U' && charArray[i + 1] === 'N' && charArray[i + 2] === 'I' && charArray[i + 3] === 'Q' && charArray[i + 4] === 'U' && charArray[i + 5] === 'E') {
        column.unique = true;
        buf = '';
        i += 5;
        continue;
      }

      if (i + 12 < charArray.length && charArray[i] === 'P' && charArray[i + 1] === 'R' && charArray[i + 2] === 'I' && charArray[i + 3] === 'M' && charArray[i + 4] === 'A' && charArray[i + 5] === 'R' && charArray[i + 6] === 'Y' && charArray[i + 7] === ' ' && charArray[i + 8] === 'K' && charArray[i + 9] === 'E' && charArray[i + 10] === 'Y' && charArray[i + 11] === ' ' && charArray[i + 12] === '(') {
        isPrimaryKeyScan = true;
        buf = '';
        i += 12;
        continue;
      }

      if (i + 10 < charArray.length && charArray[i] === 'P' && charArray[i + 1] === 'R' && charArray[i + 2] === 'I' && charArray[i + 3] === 'M' && charArray[i + 4] === 'A' && charArray[i + 5] === 'R' && charArray[i + 6] === 'Y' && charArray[i + 7] === ' ' && charArray[i + 8] === 'K' && charArray[i + 9] === 'E' && charArray[i + 10] === 'Y') {
        column.primaryKey = true;
        buf = '';
        i += 10;
        continue;
      }

      if (isPrimaryKeyScan) {
        if (charArray[i] === ')') {
          isPrimaryKeyScan = false;
          primaryKeyMap.add(buf.trim());
          buf = '';

          for (const col of tableInfo.columns) {
            if (primaryKeyMap.has(col.name)) {
              col.primaryKey = true;
            }
          }
          primaryKeyMap = new Set();
          continue;
        } else if (charArray[i] === ',') {
          primaryKeyMap.add(buf.trim());
          buf = '';
          continue;
        }
      }

      if (isDefaultScan) {
        if (charArray[i] === ' ' || charArray[i] === ',') {
          isDefaultScan = false;
          column.defaultValue = buf.trim();
          buf = '';
        }
      }

      if (charArray[i] === ' ') {
        if (parserSubStep === 0 && buf.length > 0) {
          // name
          column.name = buf.trim();
          buf = '';
          parserSubStep++;
          isTypeSizeScan = false;
          continue;
        } else if (parserSubStep === 1) {
          // type
          column.type = buf.trim().toUpperCase();
          buf = '';
          parserSubStep++;
          continue;
        }
      } else if (charArray[i] === ',' || (!isTypeSizeScan && charArray[i] === ')')) {
        if (parserSubStep === 1) {
          // type
          column.type = buf.trim().toUpperCase();
        }

        if (column.name.length !== 0) {
          tableInfo.columns.push(column);
        }

        column = createColumn();
        buf = '';
        parserSubStep = 0;
        isTypeSizeScan = false;
        continue;
      } else if (isTypeSizeScan && charArray[i] === ')') {
        isTypeSizeScan = false;
      }

      if (parserSubStep === 1 && charArrayOrg[i] === '(') {
        isTypeSizeScan = true;
      }

      buf += charArrayOrg[i];
    }
  }
  return tableInfo;
}

function handleImportDDL() {

  app.dialogs.showTextDialog('Enter the DDL to import as an ER diagram.', '').then(function ({ buttonId, returnValue }) {
    if (buttonId === 'ok') {
      try {
        const sqlList = returnValue.split(';');

        for (const sql of sqlList) {
          const tableInfo = importDDL(sql);
          console.log(tableInfo);

          if (!tableInfo.name || tableInfo.name.trim().length === 0) {
            continue;
          }

          // 調査用
          /*
          if (!app.factory._createModel) {
            app.factory._createModel = app.factory.createModel
            app.factory.createModel = (args) => {
              console.log('*** createModel ***')
              console.log(args)
              return app.factory._createModel(args)
            }
          }
          if (!app.factory._createView) {
            app.factory._createView = app.factory.createView
            app.factory.createView = (args) => {
              console.log('*** createView ***')
              console.log(args)
              return app.factory._createView(args)
            }
          }
          if (!app.factory._createModelAndView) {
            app.factory._createModelAndView = app.factory.createModelAndView
            app.factory.createModelAndView = (args) => {
              console.log('*** createModelAndView ***')
              console.log(args)
              return app.factory._createModelAndView(args)
            }
          }
          */

          const erdDiagram = app.repository.select('@ERDDiagram');
          if (!erdDiagram || erdDiagram.length === 0) {
            app.toast.error('ER diagram not found.');
            return;
          }

          const options = {
            id: 'ERDEntity',
            parent: erdDiagram[0]._parent,
            diagram: erdDiagram[0],
            x: 0,
            y: 0,
            modelInitializer: (model) => {
              model.name = tableInfo.name;
            }
          }

          const entity = app.factory.createModelAndView(options);

          for (const col of tableInfo.columns) {
            app.factory.createModel({
              id: 'ERDColumn',
              field: 'columns',
              parent: entity.model,
              modelInitializer: (model) => {
                model.name = col.name;
                model.type = col.type;
                model.primaryKey = col.primaryKey;
                model.unique = col.unique;
                model.nullable = col.nullable;
              }
            });
          }
        }

        app.toast.info('DDL import was successful.');
      } catch (e) {
        app.toast.error('Import failed.');
        throw e;
      }
    }
  });
}

function init() {
  app.commands.register(
    'tranworks-starumlext-importddl',
    handleImportDDL,
    'Import DDL'
  );
}

exports.init = init;
