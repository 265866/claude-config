# Feature-map example

Map every user-facing feature this workflow may reproduce. Read the relevant section before driving the app. Write this map from the user's point of view. Discover internals and current code paths at runtime instead of freezing them here.

Keep the completed map at a user-managed absolute path outside the installed profile, for example `<home>/claude-runtime/issue-workflows/feature-map.md` with `<home>` replaced by the user's home directory. Set `control.feature_map_path` to that path. The bundled example is not an operational map, and profile refreshes must not overwrite the completed map.

## Per-feature template

### `<feature name>`

`<one-line user-visible purpose>`

#### How a user gets there

- Click path: `<screen> -> <menu, tab, or panel> -> <control>`
- Keyboard shortcut: `<shortcut or none>`

#### How the control adapter drives it

- `<adapter action>` with `<inputs>` should `<visible result>`.
- Reset: `<how the adapter returns to a fresh state>`.

#### Stable selectors

- `<role and accessible name>`
- `<ARIA relationship>`
- `<data-component or purpose-named data attribute>`

Never use generated CSS or StyleX classes, dynamic hashes, child indexes, or brittle DOM position.

#### States to exercise

- Default, hover, focus-visible, active, disabled
- Loading, empty, error
- Selected, open, expanded
- `<relevant feature-specific variants>`

Mark states that do not apply.

#### Preconditions and setup

- Auth: `<account state>`
- Data: `<fixture>`
- Permissions: `<role>`
- Flags: `<flag or none>`
- Services: `<required availability>`

#### Evidence and cross-check

- Screenshot: `<app identity, feature, and discriminating state>`
- Video: `<entry path, interaction, and final state>`
- Cross-check: `<read-only state or value that confirms the UI>`

#### Gotchas

- `<known dead end or wrong surface>`
- `<safe environment translation>`

## Fictional example

These features belong to a fictional task app. They are examples, not required target-app features.

### Sign in

Lets a user enter the task app.

#### How a user gets there

- Click path: `app start -> Sign in`
- Keyboard shortcut: none

#### How the control adapter drives it

- `open_app`, `click Sign in`, `fill credentials`, and `click Continue` should open the item list.
- Reset by signing out and clearing the disposable session.

#### Stable selectors

- Button `Sign in`, textboxes `Email` and `Password`, `data-component="sign-in-form"`

#### States to exercise

- Default, hover, focus-visible, active, disabled, loading, error, submitting
- Not applicable: empty, selected, open, expanded

#### Preconditions and setup

- Auth: signed out, with a disposable test account
- Data: none
- Permissions: standard user
- Flags: none
- Services: authentication service available

#### Evidence and cross-check

- Screenshot: the item list with the app identity and the signed-in account visible
- Video: from the landing page through `Sign in` to the item list
- Cross-check: read-only session state shows the disposable account

#### Gotchas

- A marketing page is the wrong surface. A missing auth service is a block.

### Item list and detail

Lets a user browse items and open one.

#### How a user gets there

- Click path: `Items tab -> fixture row`
- Keyboard shortcut: none

#### How the control adapter drives it

- `select_tab Items` and `click <fixture item>` should open its detail.
- Reset by closing the detail and clearing selection.

#### Stable selectors

- Tab and list named `Items`, fixture-named row, `data-component="item-detail"`

#### States to exercise

- Default, hover, focus-visible, active, loading, empty, error, selected, open, expanded
- Not applicable: disabled

#### Preconditions and setup

- Auth: signed in as the test account
- Data: named fixture items
- Permissions: read
- Flags: none
- Services: item service available

#### Evidence and cross-check

- Screenshot: the selected row and the matching detail title
- Video: from the `Items` tab through choosing the fixture row to its open detail
- Cross-check: read-only selected-item ID matches the fixture

#### Gotchas

- Search results may look similar but use a different path.

### Item editor

Lets a user create or edit an item.

#### How a user gets there

- Click path: `item detail -> Edit`, or `Items list -> New item`
- Keyboard shortcut: none

#### How the control adapter drives it

- `click Edit`, `fill <field>`, and `click Save` should update detail.
- Reset by restoring the fixture.

#### Stable selectors

- Buttons `Edit`, `New item`, `Save`, form `Item editor`, label-linked fields

#### States to exercise

- Default, hover, focus-visible, active, disabled, error, dirty, validating, saving, success
- Not applicable: loading, empty, selected, open, expanded

#### Preconditions and setup

- Auth: signed in as the test account
- Data: an editable fixture item
- Permissions: write
- Flags: none
- Services: save service available

#### Evidence and cross-check

- Screenshot: the updated detail showing the changed field
- Video: from `Edit` through the field change and `Save` to the updated detail
- Cross-check: the stored item value, read without writing

#### Gotchas

- Do not inject form state. A read-only detail field is not the editor.

### Settings

Lets a user change personal preferences.

#### How a user gets there

- Click path: `Profile menu -> Settings`
- Keyboard shortcut: none

#### How the control adapter drives it

- `open_menu Profile`, `click Settings`, and `toggle <preference>` should update the control.
- Reset by restoring the starting preference.

#### Stable selectors

- Button `Profile`, menu item `Settings`, region `Settings`, purpose-named preference attribute

#### States to exercise

- Default, hover, focus-visible, active, disabled, loading, error, selected, open, closed
- Not applicable: empty, expanded

#### Preconditions and setup

- Auth: signed in as the test account
- Data: known starting preferences
- Permissions: standard user
- Flags: none
- Services: preference service available

#### Evidence and cross-check

- Screenshot: the `Settings` region with the final control state
- Video: from the `Profile` menu through `Settings` to the toggled preference
- Cross-check: the stored preference value, read without writing

#### Gotchas

- Operating-system settings are a different surface.

## Completeness checklist

- Every reproducible user-facing feature has a section.
- Every section names a user path, adapter actions, and reset.
- Selectors use roles, names, ARIA, stable component markers, or purpose-named attributes.
- No selector uses generated classes or DOM position.
- Relevant interaction, loading, empty, error, selected, and expanded states are covered.
- Auth, fixtures, permissions, flags, and services are explicit.
- Screenshot, video, and underlying cross-check requirements are explicit.
- Wrong surfaces, dead ends, and safe environment translations are listed.
- Implementation details remain runtime discoveries.
