# OpaDeck 憲法

## 中核の一文

> OpaDeck は operation-centric な internal ops workbench である。  
> DataSource は field を支える first-class primitive だが、モデルの中心ではない。

## 原則

### 1. Operation first

第一単位は `Operation`。closed core はこの operation を実行する意味だけを持つ。

- field は入力を提供する
- datasource は候補値や default/help データを提供する
- result view は結果を見せる(renderer は open な registry id)

help / tour / layout / card は operation core の**上に載る optional な companion 層**であり、
closed core には含めない(原則5・6、`CORE_MODEL.md` の Companion layers 参照)。

### 2. 意味層を先に置く

次を分離する。

- semantic layer
- help layer
- rendering layer

表現は変えられても、業務意味は変えない。

### 3. stable id を前提にする

label は内部キーではない。

stable id を持つ対象:

- group
- operation
- field
- panel
- help target
- tour target

### 4. convention より validation

**core** は少なくとも次を検証する。

- id 重複
- 参照切れ(body field / datasource)
- groupId mismatch

companion 層の検証は core の外に分離する(`validateApp` が合成)。

- layout binding の不整合 → layout companion
- help/tour target の不整合 → help companion
- geoScene options の不整合 → geo companion

### 5. help は companion 層(後付けではない)

OpaDeck は次を**持てる**。ただしこれらは closed core ではなく、operation core の上に載る optional な companion 層。

- inline help
- contextual help
- troubleshooting help
- interactive tour

「持てる」ことは OpaDeck の価値だが、core はこれらを知らない。help/tour の型と検証は companion 側にある。

### 6. layout も companion 層(柔軟だが浅く始める)

layout も core ではなく companion 層。primitive はこれだけに留める。

- split
- stack
- tabs
- panel

最初から重い docking IDE framework にはしない。

### 7. スコープは狭く保つ

OpaDeck は次になってはいけない。

- workflow engine
- public-site builder
- full low-code platform

