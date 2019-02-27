import * as R from 'ramda';
import { Either } from 'ramda-fantasy';
import {
  foldEither,
  explodeEither,
  validateSanctuaryType,
  omitTypeHints,
  fail,
} from 'xod-func-tools';

import { getPatchPath, resolveNodeTypesInPatch } from './patch';
import {
  listLibraryPatches,
  omitPatches,
  injectProjectTypeHints,
  listGenuinePatches,
} from './project';
import {
  addMissingOptionalProjectFields,
  omitEmptyOptionalProjectFields,
} from './optionalFieldsUtils';
import {
  migrateProjectDimensionsToSlots,
  addPositionAndSizeUnitsToPatchEntities,
} from './migrations/unitlessToSlots';
import { Project, def } from './types';

export const fromXodballData = def(
  'fromXodballData :: Object -> Either Error Project',
  R.compose(
    R.map(injectProjectTypeHints),
    foldEither(() => fail('INVALID_XODBALL_FORMAT', {}), Either.of),
    validateSanctuaryType(Project),
    migrateProjectDimensionsToSlots,
    addMissingOptionalProjectFields
  )
);

export const fromXodballDataUnsafe = def(
  'fromXodballDataUnsafe :: Object -> Project',
  R.compose(explodeEither, fromXodballData)
);

export const fromXodball = def(
  'fromXodball :: String -> Either Error Project',
  jsonString =>
    R.tryCatch(R.pipe(JSON.parse, Either.of), input =>
      fail('NOT_A_JSON', { input })
    )(jsonString).chain(fromXodballData)
);

export const toXodball = def(
  'toXodball :: Project -> String',
  R.compose(
    p => JSON.stringify(p, null, 2),
    R.evolve({ patches: R.map(addPositionAndSizeUnitsToPatchEntities) }),
    omitTypeHints,
    omitEmptyOptionalProjectFields,
    R.converge(omitPatches, [
      R.compose(R.map(getPatchPath), listLibraryPatches),
      R.identity,
    ])
  )
);

export const prepareLibPatchesToInsertIntoProject = def(
  'prepareLibPatchesToInsertIntoProject :: String -> Project -> [Patch]',
  (libName, project) =>
    R.compose(
      R.map(
        R.compose(
          resolveNodeTypesInPatch,
          R.over(R.lensProp('path'), R.replace('@', libName))
        )
      ),
      listGenuinePatches
    )(project)
);
