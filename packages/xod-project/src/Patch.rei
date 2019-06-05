type t;

type path = PatchPath.t;

let create: unit => t;

let getPath: t => path;

let assocNode: (t, Node.t) => t;

let dissocNode: (t, Node.id) => t;

let listNodes: t => list(Node.t);

let upsertNodes: (t, list(Node.t)) => t;

let getNodeById: (t, Node.id) => option(Node.t);

let assocLink: (t, Link.t) => t;

let upsertLinks: (t, list(Link.t)) => t;

let listLinks: t => list(Link.t);

let omitLinks: (t, list(Link.t)) => t;

let listPins: t => list(Pin.t);

let getPinByKey: (t, Pin.key) => option(Pin.t);

let getVariadicPinByKey: (t, Node.t, Pin.key) => option(Pin.t);

let listInputPins: t => list(Pin.t);

let listOutputPins: t => list(Pin.t);

let findPinByLabel:
  (t, string, ~normalize: bool, ~direction: option(Pin.direction)) =>
  option(Pin.t);

let getAttachments: t => list(Attachment.t);

let getTabtestContent: t => option(string);

let hasTabtest: t => bool;

let isNotImplementedInXod: t => bool;

let isAbstract: t => bool;
let isTerminal: t => bool;
let isJumper: t => bool;
let isBus: t => bool;
let isFromBus: t => bool;
let isToBus: t => bool;
