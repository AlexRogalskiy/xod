type t('left, 'right) = Js.Types.obj_val;

[@bs.module ".."]
external foldEither : ('left => 'a, 'right => 'a, t('left, 'right)) => 'a =
  "foldEither";

[@bs.module ".."] external eitherLeft : 'left => t('left, 'right) = "eitherLeft";

[@bs.module ".."] external eitherRight : 'right => t('left, 'right) = "eitherRight";

let toResult = either =>
  either
  |> foldEither(
       left => Belt.Result.Error(left),
       right => Belt.Result.Ok(right),
     );

let fromResult = result =>
  switch (result) {
  | Belt.Result.Error(left) => eitherLeft(left)
  | Belt.Result.Ok(right) => eitherRight(right)
  };
