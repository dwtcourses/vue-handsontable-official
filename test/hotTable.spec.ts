import HotTable from '../src/HotTable.vue';
import HotColumn from '../src/HotColumn.vue';
import BaseEditorComponent from '../src/BaseEditorComponent.vue';
import { mount } from '@vue/test-utils';
import {
  createDomContainer,
  createSampleData,
  mockClientDimensions
} from './_helpers';
import { LRUMap } from "../src/lib/lru/lru";
import Vue from 'vue';

describe('hotInit', () => {
  it('should initialize Handsontable and assign it to the `hotInstace` property of the provided object', () => {
    let testWrapper = mount(HotTable, {
      propsData: {
        data: createSampleData(1, 1),
        licenseKey: 'non-commercial-and-evaluation'
      }
    });

    expect(typeof testWrapper.vm.hotInstance).toEqual('object');
    expect(testWrapper.vm.hotInstance.getDataAtCell(0, 0)).toEqual('0-0');
  });
});

describe('Updating the Handsontable settings', () => {
  it('should update the previously initialized Handsontable instance with a single changed property', async() => {
    let updateSettingsCalls = 0;
    let testWrapper = mount(HotTable, {
      propsData: {
        data: createSampleData(1, 1),
        licenseKey: 'non-commercial-and-evaluation',
        rowHeaders: true,
        afterUpdateSettings: function () {
          updateSettingsCalls++;
        }
      }
    });

    expect(testWrapper.vm.hotInstance.getSettings().rowHeaders).toEqual(true);

    testWrapper.setProps({
      rowHeaders: false
    });

    await Vue.nextTick();

    expect(updateSettingsCalls).toEqual(1);
    expect(testWrapper.vm.hotInstance.getSettings().rowHeaders).toEqual(false);
  });

  it('should update the previously initialized Handsontable instance only once with multiple changed properties', async() => {
    let App = Vue.extend({
      data: function () {
        return {
          rowHeaders: true,
          colHeaders: true,
          readOnly: true,
        }
      },
      methods: {
        updateData: function () {
          this.rowHeaders = false;
          this.colHeaders = false;
          this.readOnly = false;
        }
      },
      render(h) {
        // HotTable
        return h(HotTable, {
          ref: 'hotInstance',
          props: {
            rowHeaders: this.rowHeaders,
            colHeaders: this.colHeaders,
            readOnly: this.readOnly,
            afterUpdateSettings: function () {
              updateSettingsCalls++;
            }
          }
        })
      }
    });

    let testWrapper = mount(App, {
      sync: false
    });

    let updateSettingsCalls = 0;

    const hotTableComponent = testWrapper.vm.$children[0];

    expect(hotTableComponent.hotInstance.getSettings().rowHeaders).toEqual(true);
    expect(hotTableComponent.hotInstance.getSettings().colHeaders).toEqual(true);
    expect(hotTableComponent.hotInstance.getSettings().readOnly).toEqual(true);

    testWrapper.vm.updateData();

    await Vue.nextTick();
    expect(updateSettingsCalls).toEqual(1);
    expect(hotTableComponent.hotInstance.getSettings().rowHeaders).toEqual(false);
    expect(hotTableComponent.hotInstance.getSettings().colHeaders).toEqual(false);
    expect(hotTableComponent.hotInstance.getSettings().readOnly).toEqual(false);
  });

  it('should update the previously initialized Handsontable instance with only the options that are passed to the' +
    ' component as props and actually changed', async() => {
    let newHotSettings = null;
    let App = Vue.extend({
      data: function () {
        return {
          rowHeaders: true,
          colHeaders: true,
          readOnly: true,
        }
      },
      methods: {
        updateData: function () {
          this.rowHeaders = false;
          this.colHeaders = false;
          this.readOnly = false;
        }
      },
      render(h) {
        // HotTable
        return h(HotTable, {
          ref: 'hotInstance',
          props: {
            rowHeaders: this.rowHeaders,
            colHeaders: this.colHeaders,
            readOnly: this.readOnly,
            minSpareRows: 4,
            afterUpdateSettings: function (newSettings) {
              newHotSettings = newSettings
            }
          }
        })
      }
    });

    let testWrapper = mount(App, {
      sync: false
    });

    testWrapper.vm.updateData();

    await Vue.nextTick();

    expect(Object.keys(newHotSettings).length).toBe(3)
  });

  it('should not call Handsontable\'s `updateSettings` method, when the table data was changed by reference, and the' +
    ' dataset is an array of arrays', async() => {
    let newHotSettings = null;
    let App = Vue.extend({
      data: function () {
        return {
          data: [[1, 2, 3]],
        }
      },
      methods: {
        modifyFirstRow: function () {
          Vue.set(this.data, 0, [22, 32, 42]);
        },
        addRow: function () {
          this.data.push([2, 3, 4]);
        },
        removeRow: function () {
          this.data.pop()
        },
      },
      render(h) {
        // HotTable
        return h(HotTable, {
          ref: 'hotInstance',
          props: {
            data: this.data,
            afterUpdateSettings: function (newSettings) {
              newHotSettings = newSettings
            }
          }
        })
      }
    });

    let testWrapper = mount(App, {
      sync: false
    });

    testWrapper.vm.addRow();

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1, 2, 3], [2, 3, 4]]);
    expect(newHotSettings).toBe(null);

    testWrapper.vm.removeRow();

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1, 2, 3]]);
    expect(newHotSettings).toBe(null);

    testWrapper.vm.modifyFirstRow();

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[22, 32, 42]]);
    expect(newHotSettings).toBe(null);
  });

  it('should call Handsontable\'s `updateSettings` method, when the table data was changed by reference while the' +
    ' dataset is an array of object and property number changed', async() => {
    let newHotSettings = null;
    let App = Vue.extend({
      data: function () {
        return {
          data: [{a: 1, b: 2, c: 3}],
        }
      },
      methods: {
        updateData: function (changedRow) {
          Vue.set(this.data, 0, Object.assign({}, changedRow));
        }
      },
      render(h) {
        // HotTable
        return h(HotTable, {
          ref: 'hotInstance',
          props: {
            data: this.data,
            afterUpdateSettings: function (newSettings) {
              newHotSettings = newSettings
            }
          }
        })
      }
    });

    let testWrapper = mount(App, {
      sync: false
    });

    testWrapper.vm.updateData({a: 1, b: 2, c: 3, d: 4});

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1, 2, 3, 4]]);
    expect(JSON.stringify(newHotSettings)).toBe(JSON.stringify({
      data: [{a: 1, b: 2, c: 3, d: 4}]
    }));

    testWrapper.vm.updateData({a: 1});

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1]]);
    expect(JSON.stringify(newHotSettings)).toBe(JSON.stringify({
      data: [{a: 1}]
    }));
  });

  it('should NOT call Handsontable\'s `updateSettings` method, when the table data was changed by reference while the' +
    ' dataset is an array of object and property number DID NOT change', async() => {
    let newHotSettings = null;
    let App = Vue.extend({
      data: function () {
        return {
          data: [{a: 1, b: 2, c: 3}],
        }
      },
      methods: {
        addRow: function () {
          this.data.push({a: 12, b: 22, c: 32})
        },
        removeRow: function () {
          this.data.pop()
        }
      },
      render(h) {
        // HotTable
        return h(HotTable, {
          ref: 'hotInstance',
          props: {
            data: this.data,
            afterUpdateSettings: function (newSettings) {
              newHotSettings = newSettings
            }
          }
        })
      }
    });

    let testWrapper = mount(App, {
      sync: false
    });

    testWrapper.vm.addRow();

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1, 2, 3], [12, 22, 32]]);
    expect(newHotSettings).toBe(null);

    testWrapper.vm.removeRow();

    await Vue.nextTick();

    expect(testWrapper.vm.$children[0].hotInstance.getData()).toEqual([[1, 2, 3]]);
    expect(newHotSettings).toBe(null);
  });
});

describe('getRendererWrapper', () => {
  it('should create the wrapper function for the provided renderer child component', () => {
    // mocks
    const mockVNode = {
      componentOptions: {
        Ctor: class {
          $mount() {
            return {
              $data: {},
              $el: document.createElement('TD')
            };
          }
        }
      }
    };
    const mockComponent = {
      editorCache: new Map(),
      rendererCache: new LRUMap(100),
      $parent: {}
    };

    const getRendererWrapper = (HotTable as any).methods.getRendererWrapper;
    const mockTD = document.createElement('TD');

    expect(typeof getRendererWrapper.call(mockComponent, mockVNode, mockComponent)).toEqual('function');
    expect(getRendererWrapper.call(mockComponent, mockVNode, mockComponent)({}, mockTD, 0, 0, 0, '', {})).toEqual(mockTD);
  });
});

describe('getEditorClass', () => {
  it('should create a fresh class to be used as an editor, based on the editor component provided.', () => {
    // mocks
    const mockVNode = {
      componentOptions: {
        Ctor: class {
          static get options() {
            return {
              name: 'name'
            };
          }

          $mount() {
            return {
              $data: {
                hotCustomEditorClass: class B {
                  prepare() {
                    return 'not-undefined';
                  }
                }
              },
              $el: document.createElement('TD')
            };
          }
        }
      }
    };
    const mockComponent = {
      editorCache: new Map(),
      rendererCache: new LRUMap(100),
      $parent: {}
    };

    const getEditorClass = (HotTable as any).methods.getEditorClass;
    const editorClass = getEditorClass.call(mockComponent, mockVNode, mockComponent);

    expect(editorClass.constructor).not.toEqual(void 0);
    expect(editorClass.prototype.prepare).not.toEqual(void 0);
  });
});

describe('Global editors and renderers', () => {
  it('should allow defining renderer and editor components to work globally on the entire table', () => {
    const dummyHtmlElement = document.createElement('DIV');
    dummyHtmlElement.id = 'dummy';

    const dummyEditorComponent = Vue.component('renderer-component', {
      name: 'EditorComponent',
      extends: BaseEditorComponent,
      render: function (h) {
        return h('div', {
          'attrs': {
            'id': 'dummy-editor'
          }
        });
      }
    });

    const dummyRendererComponent = Vue.component('renderer-component', {
      name: 'RendererComponent',
      render: function (h) {
        return h('div', {
          'attrs': {
            'id': 'dummy-renderer'
          }
        });
      }
    });

    let App = Vue.extend({
      render(h) {
        // HotTable
        return h(HotTable, {
          props: {
            data: createSampleData(50, 2),
            autoRowSize: false,
            autoColumnSize: false,
            width: 400,
            height: 400,
            init: function () {
              mockClientDimensions(this.rootElement, 400, 400);
            }
          }
        }, [
          h(dummyRendererComponent, {
            attrs: {
              'hot-renderer': true
            }
          }),
          h(dummyEditorComponent, {
            attrs: {
              'hot-editor': true
            }
          })
        ])
      }
    });

    let testWrapper = mount(App, {
      attachTo: createDomContainer()
    });
    const hotTableComponent = testWrapper.vm.$children[0];
    const globalEditor = hotTableComponent.hotInstance.getSettings().editor;
    const globalEditorInstance = new globalEditor(hotTableComponent.hotInstance);

    expect(globalEditorInstance._fullEditMode).toEqual(false);
    expect(globalEditorInstance.hot).toEqual(hotTableComponent.hotInstance);
    expect(hotTableComponent.hotInstance.getSettings().renderer(hotTableComponent.hotInstance, document.createElement('DIV'), 555, 0, 0, '0', {}).childNodes[0].id).toEqual('dummy-renderer');

    testWrapper.destroy();
  });
});

it('should inject an `isRenderer` and `isEditor` properties to renderer/editor components', () => {
  const dummyEditorComponent = Vue.component('renderer-component', {
    name: 'EditorComponent',
    extends: BaseEditorComponent,
    render: function (h) {
      return h('div', {
        'attrs': {
          'id': 'dummy-editor'
        }
      });
    }
  });

  const dummyRendererComponent = Vue.component('renderer-component', {
    name: 'RendererComponent',
    render: function (h) {
      return h('div', {
        'attrs': {
          'id': 'dummy-renderer'
        }
      });
    }
  });

  let App = Vue.extend({
    render(h) {
      // HotTable
      return h(HotTable, {
        props: {
          data: createSampleData(50, 2),
          licenseKey: 'non-commercial-and-evaluation',
          autoRowSize: false,
          autoColumnSize: false
        }
      }, [
        h(dummyRendererComponent, {
          attrs: {
            'hot-renderer': true
          }
        }),
        h(dummyEditorComponent, {
          attrs: {
            'hot-editor': true
          }
        })
      ])
    }
  });

  let testWrapper = mount(App, {
    attachTo: createDomContainer()
  });
  const hotTableComponent = testWrapper.vm.$children[0];

  expect(hotTableComponent.$data.rendererCache.get('0-0').component.$data.isRenderer).toEqual(true);
  expect(hotTableComponent.$data.editorCache.get('EditorComponent').$data.isEditor).toEqual(true);

  testWrapper.destroy();
});

it('should be possible to access the `hotInstance` property of the HotTable instance from a parent-component', () => {
  let hotInstanceFromRef = 'not-set';
  let App = Vue.extend({
    data: function () {
      return {
        rowHeaders: true,
        colHeaders: true,
        readOnly: true,
      }
    },
    methods: {
      cellsCallback: function() {
        if (hotInstanceFromRef === 'not-set') {
          hotInstanceFromRef = this.$refs.hTable.hotInstance;
        }
      }
    },
    render(h) {
      // HotTable
      return h(HotTable, {
        ref: 'hTable',
        props: {
          rowHeaders: this.rowHeaders,
          colHeaders: this.colHeaders,
          readOnly: this.readOnly,
          cells: this.cellsCallback
        }
      })
    }
  });

  let testWrapper = mount(App, {
    attachTo: createDomContainer()
  });

  expect(['not-set', null].includes(hotInstanceFromRef)).toBe(false);

  testWrapper.destroy();
});

it('should be possible to pass props to the editor and renderer components', () => {
  const dummyEditorComponent = Vue.component('renderer-component', {
    name: 'EditorComponent',
    extends: BaseEditorComponent,
    props: ['test-prop'],
    render: function (h) {
      return h('div', {});
    }
  });

  const dummyRendererComponent = Vue.component('renderer-component', {
    name: 'RendererComponent',
    props: ['test-prop'],
    render: function (h) {
      return h('div', {});
    }
  });

  let App = Vue.extend({
    render(h) {
      // HotTable
      return h(HotTable, {
        props: {
          data: createSampleData(1, 1),
          licenseKey: 'non-commercial-and-evaluation',
        }
      }, [
        h(dummyRendererComponent, {
          attrs: {
            'hot-renderer': true,
            'test-prop': 'test-prop-value'
          }
        }),
        h(dummyEditorComponent, {
          attrs: {
            'hot-editor': true,
            'test-prop': 'test-prop-value'
          }
        })
      ])
    }
  });

  let testWrapper = mount(App, {
    attachTo: createDomContainer()
  });
  const hotTableComponent = testWrapper.vm.$children[0];

  expect(hotTableComponent.rendererCache.get('0-0').component.$props.testProp).toEqual('test-prop-value');
  expect(hotTableComponent.editorCache.get('EditorComponent').$props.testProp).toEqual('test-prop-value');

  testWrapper.destroy();
});

it('should be possible to set a key on custom editor to use the same component twice', () => {
  const dummyEditorComponent = Vue.component('renderer-component', {
    name: 'EditorComponent',
    extends: BaseEditorComponent,
    props: ['test-prop'],
    render: function (h) {
      return h('div', {});
    }
  });

  let App = Vue.extend({
    render(h) {
      // HotTable
      return h(HotTable, {
        props: {
          data: createSampleData(2, 2),
          licenseKey: 'non-commercial-and-evaluation',
        }
      }, [
        h(HotColumn, {}, [
          h(dummyEditorComponent, {
            key: 'editor-one',
            attrs: {
              'hot-editor': true,
              'test-prop': 'test-prop-value-1'
            }
          }),
        ]),
        h(HotColumn, {}, [
          h(dummyEditorComponent, {
            key: 'editor-two',
            attrs: {
              'hot-editor': true,
              'test-prop': 'test-prop-value-2'
            }
          })
        ])
      ])
    }
  });

  let testWrapper = mount(App, {
    attachToDocument: true
  });
  const hotTableComponent = testWrapper.vm.$children[0];

  expect(hotTableComponent.editorCache.get('EditorComponent:editor-one').$props.testProp).toEqual('test-prop-value-1');
  expect(hotTableComponent.editorCache.get('EditorComponent:editor-two').$props.testProp).toEqual('test-prop-value-2');

  testWrapper.destroy();
});
