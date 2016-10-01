
import R from 'ramda';
import { assert, expect } from 'chai';
import transform from '../src/transformer';

const ioTypes = {
  'core/inputBool': {
    key: 'core/inputBool',
    pins: { PIN: { direction: 'output', key: 'PIN', type: 'bool' } },
  },
  'core/outputBool': {
    key: 'core/outputBool',
    pins: { PIN: { direction: 'input', key: 'PIN', type: 'bool' } },
  },
};

const buttonAndLedTypes = {
  button: {
    key: 'button',
    pins: {
      state: {
        direction: 'output',
        key: 'state',
        type: 'bool',
      },
    },
  },
  led: {
    key: 'led',
    pins: {
      brightness: {
        direction: 'input',
        key: 'brightness',
        type: 'number',
      },
    },
  },
};

const hasLink = (result, [nodeFrom, pinFrom, pinTo, nodeTo]) => R.equals(
  result.nodes[nodeFrom.toString()].outLinks,
  { [pinFrom]: [{ key: pinTo, nodeId: nodeTo }] }
);

const hasTopology = result => R.equals(
  R.map(id => [id, result.nodes[id].implId], result.topology)
);

const link = (id, [nodeFrom, pinFrom, pinTo, nodeTo]) => ({
  id,
  pins: [
    { nodeId: nodeFrom, pinKey: pinFrom },
    { nodeId: nodeTo, pinKey: pinTo },
  ],
});


describe('Transformer', () => {
  it('should transform empty json to empty result', () => {
    const result = transform({});
    expect(result.nodes).to.be.eql({});
    expect(result.impl).to.be.eql({});
  });

  it('should merge node and node type', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            42: {
              id: 42,
              typeId: 'core/add100',
              properties: { someValue: 'foo' },
            },
          },
        },
      },
      nodeTypes: {
        'core/add100': {
          key: 'core/add100',
          pure: true,
          pins: {
            valueIn: {
              direction: 'input',
              key: 'valueIn',
              type: 'number',
            },
            valueOut: {
              direction: 'output',
              key: 'valueOut',
              type: 'number',
            },
          },
        },
      },
    });

    expect(result.nodes).to.be.eql({
      42: {
        id: 42,
        implId: 'core/add100',
        pure: true,
        inputTypes: {
          valueIn: Number,
        },
        outLinks: {},
        props: { someValue: 'foo' },
      },
    });
  });

  it('should extract implementation', () => {
    const js = 'module.exports.setup = function() {}';
    const cpp = 'void setup(void*) {}';

    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            42: { id: 42, typeId: 'core/add100' },
          },
        },
      },
      nodeTypes: {
        'core/add100': {
          id: 'core/add100',
          impl: { js, cpp },
        },
      },
    }, ['es6', 'js']);

    expect(result.impl).to.be.eql({ 'core/add100': js });
  });

  it('should merge links', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            42: { id: 42, typeId: 'core/add100' },
            43: { id: 43, typeId: 'core/add100' },
          },
          links: {
            1: link(1, [42, 'valueOut', 'valueIn', 43]),
          },
        },
      },
      nodeTypes: {
        'core/add100': {
          id: 'core/add100',
          pins: {
            valueIn: {
              direction: 'input',
              key: 'valueIn',
              type: 'number',
            },
            valueOut: {
              direction: 'output',
              key: 'valueOut',
              type: 'number',
            },
          },
        },
      },
    });

    expect(result.nodes[42].outLinks).to.be.eql({
      valueOut: [{
        nodeId: 43,
        key: 'valueIn',
      }],
    });
  });

  it('should merge patches', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            42: { id: 42, typeId: 'core/add100' },
          },
        },
        2: {
          id: 2,
          nodes: {
            43: { id: 43, typeId: 'core/add100' },
          },
        },
      },
      nodeTypes: {
        'core/add100': {
          id: 'core/add100',
          pins: {},
        },
      },
    });

    expect(result.nodes).to.have.property(42);
    expect(result.nodes).to.have.property(43);
  });

  it('should sort nodes', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            42: { id: 42, typeId: 'core/add100' },
            43: { id: 43, typeId: 'core/add100' },
          },
          links: {
            1: link(1, [42, 'valueOut', 'valueIn', 43]),
          },
        },
      },
      nodeTypes: {
        'core/add100': {
          id: 'core/add100',
          pins: {
            valueIn: {
              direction: 'input',
              key: 'valueIn',
              type: 'number',
            },
            valueOut: {
              direction: 'output',
              key: 'valueOut',
              type: 'number',
            },
          },
        },
      },
    });

    expect(result.topology).to.be.eql([42, 43]);
  });

  it('should inject patchnode with input only', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            101: { id: 101, typeId: 'foo/NOP' },
          },
          links: {},
        },
        2: {
          id: 2,
          name: 'NOP',
          nodes: {
            42: { id: 42, typeId: 'core/inputPulse' },
          },
        },
      },
    });

    assert(
      R.equals(R.keys(result.nodes), ['102']),
      'inserted node must have an id which equals (last used id + 1)'
    );

    expect(
      result.nodes['102']
    ).to.be.eql({
      id: 102,
      inputTypes: {},
      outLinks: {},
      implId: 'core/inputPulse',
    });
  });

  it('should inject patchnode with output only', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            101: { id: 101, typeId: 'foo/NOP' },
          },
          links: {},
        },
        2: {
          id: 2,
          name: 'NOP',
          nodes: {
            42: { id: 42, typeId: 'core/outputPulse' },
          },
        },
      },
    });

    assert(
      R.equals(R.keys(result.nodes), ['102']),
      'inserted node must have an id which equals (last used id + 1)'
    );

    expect(
      result.nodes['102']
    ).to.be.eql({
      id: 102,
      inputTypes: {},
      outLinks: {},
      implId: 'core/outputPulse',
    });
  });

  it('injected input should be connected properly', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            100: { id: 100, typeId: 'button' },
            101: { id: 101, typeId: 'foo/BULB' },
          },
          links: {
            1: link(1, [100, 'state', 'input_41', 101]),
          },
        },
        2: {
          id: 2,
          name: 'BULB',
          nodes: {
            41: { id: 41, typeId: 'core/inputBool' },
            42: { id: 42, typeId: 'led' },
          },
          links: {
            2: link(2, [41, 'PIN', 'brightness', 42]),
          },
        },
      },
      nodeTypes: R.merge(ioTypes, buttonAndLedTypes),
    });

    assert(R.equals(
      R.map(id => [id, result.nodes[id].implId], result.topology),
      [[100, 'button'],
       [102, 'core/inputBool'], // terminals receive their ids after nodes
       [103, 'led']]
    ));

    assert(hasLink(result,
                   [100, 'state', 'PIN', 102]),
           'button should be connected to inputBool');

    assert(hasLink(result,
                   [102, 'PIN', 'brightness', 103]),
           'inputBool should be connected to led');

    assert(R.equals(result.nodes['102'].inputTypes,
                    { PIN: Boolean }),
           'inputBool should get a proper inputType');
  });

  it('injected output should be connected properly', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            100: { id: 100, typeId: 'foo/BTN' },
            101: { id: 101, typeId: 'led' },
          },
          links: {
            1: link(1, [100, 'output_42', 'brightness', 101]),
          },
        },
        2: {
          id: 2,
          name: 'BTN',
          nodes: {
            41: { id: 41, typeId: 'button' },
            42: { id: 42, typeId: 'core/outputBool' },
          },
          links: {
            2: link(2, [41, 'state', 'PIN', 42]),
          },
        },
      },
      nodeTypes: R.merge(ioTypes, buttonAndLedTypes),
    });

    assert(hasTopology(result)([
      [102, 'button'],
      [103, 'core/outputBool'],
      [101, 'led'],
    ]));

    assert(hasLink(result,
                   [102, 'state', 'PIN', 103]),
           'button should be connected to outputBool');

    assert(hasLink(result,
                   [103, 'PIN', 'brightness', 101]),
           'outputBool should be connected to led');
  });

  it('injected input should be connected properly', () => {
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            100: { id: 100, typeId: 'button' },
            101: { id: 101, typeId: 'foo/BULB' },
          },
          links: {
            1: link(1, [100, 'state', 'input_41', 101]),
          },
        },
        2: {
          id: 2,
          name: 'BULB',
          nodes: {
            41: { id: 41, typeId: 'core/inputBool' },
            42: { id: 42, typeId: 'led' },
          },
          links: {
            2: link(2, [41, 'PIN', 'brightness', 42]),
          },
        },
      },
      nodeTypes: R.merge(ioTypes, buttonAndLedTypes),
    });

    assert(hasTopology(result)([
      [100, 'button'],
      [102, 'core/inputBool'], // terminals receive its ids after nodes
      [103, 'led'],
    ]));

    assert(hasLink(result,
                   [100, 'state', 'PIN', 102]),
           'button should be connected to inputBool');

    assert(hasLink(result,
                   [102, 'PIN', 'brightness', 103]),
           'inputBool should be connected to led');

    assert(R.equals(result.nodes['102'].inputTypes,
                    { PIN: Boolean }),
           'inputBool should get a proper inputType');
  });

  it('nested patch nodes (w/o loops) should be injected properly', () => {
    /*
         button
            |
    AUX-inputBool-------+
    |        |          |
    | NOP-inputBool---+ |
    | |       |       | |
    | |       |       | |
    | +---outputBool--+ |
    |        |          |
    +----outputBool-----+
            |
     NOP-inputBool---+
     |       |       |
     |       |       |
     +---outputBool--+
            |
           led
    */
    const result = transform({
      patches: {
        1: {
          id: 1,
          nodes: {
            100: { id: 100, typeId: 'button' },
            101: { id: 101, typeId: 'foo/AUX' },
            102: { id: 102, typeId: 'foo/NOP' },
            103: { id: 103, typeId: 'led' },
          },
          links: {
            1: link(1, [100, 'state', 'input_41', 101]),
            2: link(2, [101, 'output_43', 'input_61', 102]),
            3: link(3, [102, 'output_62', 'brightness', 103]),
          },
        },
        2: {
          id: 2,
          name: 'AUX',
          nodes: {
            41: { id: 41, typeId: 'core/inputBool' },
            42: { id: 42, typeId: 'foo/NOP' },
            43: { id: 43, typeId: 'core/outputBool' },
          },
          links: {
            4: link(5, [41, 'PIN', 'input_61', 42]),
            5: link(6, [42, 'output_62', 'PIN', 43]),
          },
        },
        3: {
          id: 3,
          name: 'NOP',
          nodes: {
            61: { id: 61, typeId: 'core/inputBool' },
            62: { id: 62, typeId: 'core/outputBool' },
          },
          links: {
            6: link(6, [61, 'PIN', 'PIN', 62]),
          },
        },
      },
      nodeTypes: R.merge(ioTypes, buttonAndLedTypes),
    });

    assert(hasTopology(result)([
      [100, 'button'],
      [104, 'core/inputBool'],
      [109, 'core/inputBool'],
      [110, 'core/outputBool'],
      [106, 'core/outputBool'],
      [107, 'core/inputBool'],
      [108, 'core/outputBool'],
      [103, 'led'],
    ]));
  });
});
