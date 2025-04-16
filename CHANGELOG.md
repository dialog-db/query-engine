# Changelog

## [0.10.0](https://github.com/dialog-db/query-engine/compare/v0.9.2...v0.10.0) (2025-04-16)


### ⚠ BREAKING CHANGES

* query engine rewrite
* save changes
* remove Form clause

### stash

* save changes ([da50feb](https://github.com/dialog-db/query-engine/commit/da50feb3b2ef8d8c416fcd59b68c62581348ece1))


### Features

* add rule analyzer ([034d230](https://github.com/dialog-db/query-engine/commit/034d2305a1548dd33d3c615e0b28754ce65f1b9b))
* change rule interface ([f43bc6c](https://github.com/dialog-db/query-engine/commit/f43bc6c99d6246eb6f33fc978002b74d0a81bbe3))
* enable LRU cache ([510871c](https://github.com/dialog-db/query-engine/commit/510871c72ac01d2397da5419e86292313063c595))
* Further improve schema / rule API ([a9791dd](https://github.com/dialog-db/query-engine/commit/a9791dd96d6bc8e3a2ae3263ab502d9546d783d2))
* implement disjunctive rule dsl ([f798bfa](https://github.com/dialog-db/query-engine/commit/f798bfa5579df4da3ad5a142bbd3e7674cc36c7b))
* implement schema DSL ([902843b](https://github.com/dialog-db/query-engine/commit/902843b49e4d93b63d7efe11eff4a5b9fd942c83))
* implement simpler execute metho ([503c746](https://github.com/dialog-db/query-engine/commit/503c74687d8c5eb3cdfd2618308d3b055a8a5cf1))
* implement simplified interface ([0d9ffcb](https://github.com/dialog-db/query-engine/commit/0d9ffcb45d7f627dd81e92eb9899a0458e8dad88))
* improve rule planner ([6636979](https://github.com/dialog-db/query-engine/commit/6636979ba0aa4d0ab43e476ea03fed50e6f6f120))
* query engine rewrite ([2c33dd9](https://github.com/dialog-db/query-engine/commit/2c33dd95c98e0589141db0f242c902783f0dbe14))
* refactor rules ([1b7de2e](https://github.com/dialog-db/query-engine/commit/1b7de2e48153144698fd1a213d9589494a2123a7))
* remove Form clause ([ccd4c63](https://github.com/dialog-db/query-engine/commit/ccd4c63cf23fcf434eb7a5d02b0dd545da0d91a9))
* setup radicle mirror ([cc5ddab](https://github.com/dialog-db/query-engine/commit/cc5ddab49602700969d1144aed6ab181d03d3539))
* setup radicle mirror ([#66](https://github.com/dialog-db/query-engine/issues/66)) ([fd20fa9](https://github.com/dialog-db/query-engine/commit/fd20fa99d7ec63509656f1b8ea1d4a3a7c182600))
* simplify dependency analysis ([54a505e](https://github.com/dialog-db/query-engine/commit/54a505e5584aa7a4db75feaa39452f1afb4a25bb))
* update data source interface ([e0edccf](https://github.com/dialog-db/query-engine/commit/e0edccf9b57899ba34280954fe6651d49b3353aa))
* upgrade schema logic ([d610677](https://github.com/dialog-db/query-engine/commit/d610677fa2d53b6bfc18437b05e9367e184ddea5))


### Bug Fixes

* _ handling in the analyzer ([7fde2cb](https://github.com/dialog-db/query-engine/commit/7fde2cbd370ec652f33a551d48144dfe0b4619b7))
* add cycle detection logic ([8d6fe68](https://github.com/dialog-db/query-engine/commit/8d6fe68c25ce9465b237707e32b463082980eefc))
* add support for literals in type definitions ([1e5eb20](https://github.com/dialog-db/query-engine/commit/1e5eb20134d148d60eb9f47076cae514eb62da57))
* align schema dsl ([f46925c](https://github.com/dialog-db/query-engine/commit/f46925cab61a3b8b3028bb0538599169b27e6aed))
* all the schema stuff ([0a2f43b](https://github.com/dialog-db/query-engine/commit/0a2f43b164f53834863fc03c577a1892017f4ef9))
* allow binding two variables to one ([9a48391](https://github.com/dialog-db/query-engine/commit/9a48391013c9d9e2cdf48c353d6598fadda9ca5e))
* avoid duplicate rules ([0467f67](https://github.com/dialog-db/query-engine/commit/0467f67d2ce3bd041f84bc8e5b0520f8454dfe01))
* cleanup legacy code ([d0d5b93](https://github.com/dialog-db/query-engine/commit/d0d5b93bca60b248dbbf0a3f64c5f42c2441b2af))
* complete rescan on every clause of every frame ([00961c9](https://github.com/dialog-db/query-engine/commit/00961c91f1eceb84730d2f60ea49721504b01a7f))
* copy applied constants into match ([ce65ab5](https://github.com/dialog-db/query-engine/commit/ce65ab57cd7ae3ee547b2a5f0a4014046726d646))
* enable most tests ([a607ed9](https://github.com/dialog-db/query-engine/commit/a607ed969923f9e862a3614cd5d7de44d9ef042e))
* estimates in joins ([8d1ca02](https://github.com/dialog-db/query-engine/commit/8d1ca026298c43c2df528e3a9840c61100b0a2c8))
* evaluator recognizing joined cells ([10cdf26](https://github.com/dialog-db/query-engine/commit/10cdf26192df0ad623a38fab1c56b50a3f613edf))
* implement aggregation support ([ce8dacb](https://github.com/dialog-db/query-engine/commit/ce8dacb6ef3343e5125c46d68458353d72d6b122))
* implement test for disjunctive rule ([12e6d33](https://github.com/dialog-db/query-engine/commit/12e6d331b23ba02d47fd344433998e5f3ec0bb1e))
* make `when` type distinct from `where` ([1fd638a](https://github.com/dialog-db/query-engine/commit/1fd638a6fce07da9168f7c88600e28e154e3dabf))
* make callable generics possible ([fc36b3e](https://github.com/dialog-db/query-engine/commit/fc36b3e3482e2b354b4a46802a1db247c3f9591e))
* make or more permissive ([4996cd4](https://github.com/dialog-db/query-engine/commit/4996cd4c1d8fd2452f2602ece85e878365ae0844))
* make rule body conjuncts ([f89ce93](https://github.com/dialog-db/query-engine/commit/f89ce93272d941266ddf14a2345462a577b9b2de))
* make variables in negation required ([c2dfaa3](https://github.com/dialog-db/query-engine/commit/c2dfaa395defaa4ae300b809f3eaac2c8cc2274a))
* mirror only on pushes to main branches ([b21bebd](https://github.com/dialog-db/query-engine/commit/b21bebd9734f536d23e9ba11ebb7e91044bd3b07))
* mirror only on pushes to main branches ([#67](https://github.com/dialog-db/query-engine/issues/67)) ([92d67b1](https://github.com/dialog-db/query-engine/commit/92d67b1c252e74e8709295198b3908898e6a23ed))
* mitigate infinite loop ([d258e0f](https://github.com/dialog-db/query-engine/commit/d258e0fe7bacafa1caf2cd4afbdb55dd7093ed1c))
* more problems with recursive rules ([879871e](https://github.com/dialog-db/query-engine/commit/879871edb793fe945dbbf09c1fbed20bfadca03e))
* port some schema tests ([d97db58](https://github.com/dialog-db/query-engine/commit/d97db58f4d5d5332e1c705eaea3b8b0e6bde9177))
* recursive rules ([c2fd56d](https://github.com/dialog-db/query-engine/commit/c2fd56d7f9114ee63570865dd982bfe30c11beb6))
* remaining problems ([e02731c](https://github.com/dialog-db/query-engine/commit/e02731c573f2a934e544acd9a3435479125a3998))
* remove circuit code ([052c290](https://github.com/dialog-db/query-engine/commit/052c29085c74a75169d8291fed756fdd0201a7f4))
* replace workaround with a better fix ([bba0c78](https://github.com/dialog-db/query-engine/commit/bba0c78e542eabdf62ce3dcd63b823bd3a0499dd))
* require non-recursive branch ([fc1611e](https://github.com/dialog-db/query-engine/commit/fc1611e4c683014403c0cf094e87cd6898de6cc2))
* rule planner making it stateless ([cc86fef](https://github.com/dialog-db/query-engine/commit/cc86fefdd1e7f5173f12f96270b34316edfa72f3))
* schema stuff ([d4657e7](https://github.com/dialog-db/query-engine/commit/d4657e79fc3278d3316b557ece766ab16093aa72))
* scope ([9fbc2ed](https://github.com/dialog-db/query-engine/commit/9fbc2ed3b1f59999398824c3ac59476402f01491))
* support for nested rules ([47572d6](https://github.com/dialog-db/query-engine/commit/47572d60d6470b1ebb5dfd4bd914122ae4eedd1a))
* test and recursion ([a6bd103](https://github.com/dialog-db/query-engine/commit/a6bd103fafd626acbbe559d1ed768258a4d1f1e4))
* type checking ([69f11dd](https://github.com/dialog-db/query-engine/commit/69f11dd690e2e9d1c61e486966c75ba4f369f1b4))
* type error ([86f917f](https://github.com/dialog-db/query-engine/commit/86f917f820de5c2798aeb110910e7c5bb5356a59))
* update more tests ([a76c119](https://github.com/dialog-db/query-engine/commit/a76c11940a34c5fa428788e8e0bf40e91e5dfb84))
* update more tests ([fd37f49](https://github.com/dialog-db/query-engine/commit/fd37f49bcd87bebb1759372219f92d92c697ba40))
* use more sophisticated scope construct ([37e0815](https://github.com/dialog-db/query-engine/commit/37e0815b64d92eeeff6bea2f513a16cdc71d7fac))
* use of implicit variables ([36cd482](https://github.com/dialog-db/query-engine/commit/36cd48226c29a0b9d74efb746c35a2877c7e7de1))
* workaround the problem in recursion ([cbd98e0](https://github.com/dialog-db/query-engine/commit/cbd98e0f1d78ff919f513a20a022eb191724c570))
* workaround unification bug ([4a6bcec](https://github.com/dialog-db/query-engine/commit/4a6bceccd35d1ff3ac6afd2094b7b94e000983ba))

## [0.9.2](https://github.com/Gozala/datalogia/compare/v0.9.1...v0.9.2) (2024-10-30)


### Bug Fixes

* grouping ([#56](https://github.com/Gozala/datalogia/issues/56)) ([58fb806](https://github.com/Gozala/datalogia/commit/58fb806c7959006860a8a1093ce16ae60b257ecf))
* hopefully fix grouping for real ([8cb6079](https://github.com/Gozala/datalogia/commit/8cb60798c7f0920ce2f4cb0156263651f20fe7a7))

## [0.9.1](https://github.com/Gozala/datalogia/compare/v0.9.0...v0.9.1) (2024-10-30)


### Bug Fixes

* grouping issue ([ff79595](https://github.com/Gozala/datalogia/commit/ff79595991293a3f568b488377d471d817a0c700))
* grouping logic ([#53](https://github.com/Gozala/datalogia/issues/53)) ([624fb1d](https://github.com/Gozala/datalogia/commit/624fb1d4eed739c3c3dcda5ae4c6b823feb395b9))
* query planner ([#51](https://github.com/Gozala/datalogia/issues/51)) ([2e5c77f](https://github.com/Gozala/datalogia/commit/2e5c77fd94cb25121d20fce0f32e57f7d17b3441))
* rank function ([88bdede](https://github.com/Gozala/datalogia/commit/88bdedee2c6d99f3ff9c7aa509c2896b617a6bb9))
* ranking algorithm for query planner ([1684cb4](https://github.com/Gozala/datalogia/commit/1684cb45ef972fbf94a93b0468311fadaeae7823))

## [0.9.0](https://github.com/Gozala/datalogia/compare/v0.8.3...v0.9.0) (2024-10-25)


### Features

* make Task.perform sync ([9f2c091](https://github.com/Gozala/datalogia/commit/9f2c091b54fb071b715c57b37e196bb8cf8cfb3f))
* task sync execution ([#48](https://github.com/Gozala/datalogia/issues/48)) ([ba2c0fb](https://github.com/Gozala/datalogia/commit/ba2c0fbe2a79cdddcbdb060e624a2e61bea2650f))


### Bug Fixes

* failure on sync execution ([c3bf8bb](https://github.com/Gozala/datalogia/commit/c3bf8bbffd6b4a87abcd6b588c3053b49a06f994))

## [0.8.3](https://github.com/Gozala/datalogia/compare/v0.8.2...v0.8.3) (2024-10-18)


### Bug Fixes

* make type parameter optional ([f7d717a](https://github.com/Gozala/datalogia/commit/f7d717af1270e71bb9b9a7033e97d88e868b1aa4))
* make type parameter optional ([#45](https://github.com/Gozala/datalogia/issues/45)) ([cc1f84e](https://github.com/Gozala/datalogia/commit/cc1f84e2baca0c6dbdb38ce29625871bdb417e90))

## [0.8.2](https://github.com/Gozala/datalogia/compare/v0.8.1...v0.8.2) (2024-10-18)


### Bug Fixes

* bump version ([79e3b91](https://github.com/Gozala/datalogia/commit/79e3b91ae0d6d41c20240fb2e0c9617a74cdfb1f))
* bump version ([#43](https://github.com/Gozala/datalogia/issues/43)) ([cb745ea](https://github.com/Gozala/datalogia/commit/cb745ea74298ff0a01ed58d34f1658ffd076dfff))

## [0.8.1](https://github.com/Gozala/datalogia/compare/v0.8.0...v0.8.1) (2024-10-18)


### Bug Fixes

* add task and variable to export maps ([8380ae9](https://github.com/Gozala/datalogia/commit/8380ae9dcca4c8283b5c4459439b4521c3817d22))
* add task and variable to export maps ([#40](https://github.com/Gozala/datalogia/issues/40)) ([b30d2e8](https://github.com/Gozala/datalogia/commit/b30d2e804c4b48256bcceae76b4d45b004ca0394))

## [0.8.0](https://github.com/Gozala/datalogia/compare/v0.7.0...v0.8.0) (2024-10-15)


### Features

* implement relational operators ([#37](https://github.com/Gozala/datalogia/issues/37)) ([9d9f4ac](https://github.com/Gozala/datalogia/commit/9d9f4ac5f7bd4bf2b78285f3095077a68ef54f61))
* implement relational predicates ([6d75a49](https://github.com/Gozala/datalogia/commit/6d75a499dfc6f127ea7655f45d24de627529afd4))
* implement std formulas ([99f2115](https://github.com/Gozala/datalogia/commit/99f2115c21fba07b381e4c27d6bdd50334c161ef))


### Bug Fixes

* type errors ([8fbfef5](https://github.com/Gozala/datalogia/commit/8fbfef50a9b4f63178b18fbf8f141d795bdc2910))

## [0.7.0](https://github.com/Gozala/datalogia/compare/v0.6.0...v0.7.0) (2024-09-20)


### ⚠ BREAKING CHANGES

* aggregatation ([#30](https://github.com/Gozala/datalogia/issues/30))

### Features

* aggregatation ([#30](https://github.com/Gozala/datalogia/issues/30)) ([c4da5ff](https://github.com/Gozala/datalogia/commit/c4da5ff5c895de3858f859aafee814e250550e9a))
* implement basic aggregation ([d8fc867](https://github.com/Gozala/datalogia/commit/d8fc8671f03432103200a211b3b902f1b3604dd7))

## [0.6.0](https://github.com/Gozala/datalogia/compare/v0.5.0...v0.6.0) (2024-09-19)


### ⚠ BREAKING CHANGES

* async query and transaction interface ([#32](https://github.com/Gozala/datalogia/issues/32))

### Features

* async query and transaction interface ([#32](https://github.com/Gozala/datalogia/issues/32)) ([334dd6e](https://github.com/Gozala/datalogia/commit/334dd6e741ff226a4b37944175bab6a2141d3c04))
* Make query return a task ([b7fb110](https://github.com/Gozala/datalogia/commit/b7fb110a3553f8865054311cb6fbd8230b249425))

## [0.5.0](https://github.com/Gozala/datalogia/compare/v0.4.0...v0.5.0) (2024-09-19)


### Features

* implement is operator ([a19489c](https://github.com/Gozala/datalogia/commit/a19489c4b029c1f2de0e28c2c89be85298c396b7))
* implement is operator ([#31](https://github.com/Gozala/datalogia/issues/31)) ([d0d25c4](https://github.com/Gozala/datalogia/commit/d0d25c4e258adb008ff00ea4a35956b167dbee5b))
* implement recursive rule support ([7865ff7](https://github.com/Gozala/datalogia/commit/7865ff731edb01d03281d5e29fed0a4563967927))
* implement support for recursion ([87ccb67](https://github.com/Gozala/datalogia/commit/87ccb67ff56a666feee134771eb8ecf18dc48a0d))
* recursion ([#27](https://github.com/Gozala/datalogia/issues/27)) ([52ad2a4](https://github.com/Gozala/datalogia/commit/52ad2a4bbab48eb8955c68ae97728a73154cf0e8))


### Bug Fixes

* code paths that required updates ([611aa75](https://github.com/Gozala/datalogia/commit/611aa75182cc32c3264c53d22f2e1b139a85e17e))

## [0.4.0](https://github.com/Gozala/datalogia/compare/v0.3.1...v0.4.0) (2024-02-07)


### Features

* implement nested selectors ([a26668d](https://github.com/Gozala/datalogia/commit/a26668dca08b04e1d45ab69934a8fc2178b69542))
* nested selector ([#20](https://github.com/Gozala/datalogia/issues/20)) ([1d12da3](https://github.com/Gozala/datalogia/commit/1d12da3da4bdf02bd473d81923a3c3efee64157a))

## [0.3.1](https://github.com/Gozala/datalogia/compare/v0.3.0...v0.3.1) (2024-02-06)


### Bug Fixes

* clause sorting order ([811091b](https://github.com/Gozala/datalogia/commit/811091b83e0c16db4d1cb4aeabbf1a4514a61c5e))
* clause sorting order ([#18](https://github.com/Gozala/datalogia/issues/18)) ([558fb08](https://github.com/Gozala/datalogia/commit/558fb08891dd85046f053103a1656459a02f5650))

## [0.3.0](https://github.com/Gozala/datalogia/compare/v0.2.0...v0.3.0) (2024-01-31)


### Features

* add glob and like constraints ([#16](https://github.com/Gozala/datalogia/issues/16)) ([991253d](https://github.com/Gozala/datalogia/commit/991253d5a3065a36bbc4967b0d19b2b32ba8e66b))
* export variable and confirm functions ([d936e5d](https://github.com/Gozala/datalogia/commit/d936e5da7b91b81f867e379302823985f71b8568))
* like & glob patterns ([56e196c](https://github.com/Gozala/datalogia/commit/56e196cf118d8a3d713dffceb72dcb9a509f157e))

## [0.2.0](https://github.com/Gozala/datalogia/compare/v0.1.1...v0.2.0) (2024-01-30)


### Features

* simplify entity model ([#8](https://github.com/Gozala/datalogia/issues/8)) ([9bc04e0](https://github.com/Gozala/datalogia/commit/9bc04e06e0887c9648ec00907d212b39ba745f9d))

## [0.1.1](https://github.com/Gozala/datalogia/compare/v0.1.0...v0.1.1) (2024-01-30)


### Bug Fixes

* publish typedefs ([41db463](https://github.com/Gozala/datalogia/commit/41db463205c43851a4ba716b685d0c8738205981))
* publish typedefs ([#10](https://github.com/Gozala/datalogia/issues/10)) ([70aa596](https://github.com/Gozala/datalogia/commit/70aa5966b2aaee3ae3bde69bd357b8a9850af93d))

## [0.1.0](https://github.com/Gozala/datalogia/compare/v0.0.2...v0.1.0) (2024-01-17)


### Features

* basic rules engine ([57e713a](https://github.com/Gozala/datalogia/commit/57e713addf2a2eca6601c181b4269a838791917b))
* implement pomodb spec ([7710109](https://github.com/Gozala/datalogia/commit/77101096dcf03153c1ad80acdfbb265eaec5f4a3))
* implement predicates ([9d515c3](https://github.com/Gozala/datalogia/commit/9d515c3cddfcd96e4c0c9f9906dc3111915aec11))
* implement predicates, rules and query optimizations ([#7](https://github.com/Gozala/datalogia/issues/7)) ([86d30db](https://github.com/Gozala/datalogia/commit/86d30dbf30ea2930af13a901d7e454c77dd30274))
* implement query combinators ([79603a9](https://github.com/Gozala/datalogia/commit/79603a9dac3afe90e5da4b7ed27c6d660fa0a281))
* negation ([9716489](https://github.com/Gozala/datalogia/commit/9716489152c5e705cba5224a5b2db1c876242c60))


### Bug Fixes

* align implementations ([94a26a3](https://github.com/Gozala/datalogia/commit/94a26a32b0fb2cbadd1c6e5f3e146b2863612c94))
* db initializer ([966fcd8](https://github.com/Gozala/datalogia/commit/966fcd8c6eb7ab5a1520bdbcff81accee58967ef))
* invalid reference ([06af02e](https://github.com/Gozala/datalogia/commit/06af02e194242b65eb6a2fdb0676bca48151e837))
* some reference errors ([ac6f516](https://github.com/Gozala/datalogia/commit/ac6f51620cf6897302ac9566af1256080e60169f))
* types ([10b03dc](https://github.com/Gozala/datalogia/commit/10b03dc40ccdf2db5e289a50ad56116c07b1204c))

## [0.0.2](https://github.com/Gozala/deductive/compare/v0.0.1...v0.0.2) (2023-12-17)


### Bug Fixes

* rename to datalogia ([#5](https://github.com/Gozala/deductive/issues/5)) ([c4aa6a4](https://github.com/Gozala/deductive/commit/c4aa6a4744e58c8eaabf09286b459ae5f7751471))

## 0.0.1 (2023-12-17)


### Features

* implement naive query engine ([c32423b](https://github.com/Gozala/deductive/commit/c32423bc42668de95398f20726d706720671b627))
* implement naive query engine ([55b1c45](https://github.com/Gozala/deductive/commit/55b1c456b175143cfb7982ff9fa71d9e7d7c7cde))


### Bug Fixes

* ci permissions ([612b752](https://github.com/Gozala/deductive/commit/612b7527c5389d894e5ff6ef929e838010a37dd9))
* revert to version 3 ([3fbc383](https://github.com/Gozala/deductive/commit/3fbc3834e55e584b49cbd808e9bd7c444dceb929))


### Miscellaneous Chores

* release 0.0.1 ([4c522a5](https://github.com/Gozala/deductive/commit/4c522a5ef2e39aec330aab90ed0f50a50f6ad34d))
* release 0.0.1 ([60e3873](https://github.com/Gozala/deductive/commit/60e38731332e3142e36438c3cdf5d031a570b8f2))
* release 0.0.1 ([48109e5](https://github.com/Gozala/deductive/commit/48109e530570508f6e90956bfe49486e072b47d3))
