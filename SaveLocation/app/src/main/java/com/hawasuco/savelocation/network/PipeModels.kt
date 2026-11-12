package com.hawasuco.savelocation.network

/** Ba nhóm lớp đường ống giống web SCADA: ống hiện hữu, đang triển khai, dự kiến. */
object PipeKind {
    const val PIPE = "pipe"
    const val BUILD = "pipe_build"
    const val PLAN = "pipe_plan"
    val ALL = listOf(PIPE, BUILD, PLAN)
}

/** Kiểu nét: liền, đứt (dự kiến), gạch chấm (đang triển khai). */
object PipeDash {
    const val SOLID = 0
    const val PLANNED = 1
    const val BUILD = 2
}

/** Một lớp đường ống (lấy theo LAYER_META của bản đồ SCADA). */
data class PipeLayer(
    val id: Long,
    var name: String,
    var kind: String,
    var color: Int,
    var weight: Float,
    var visible: Boolean,
    var order: Int,
    var featureCount: Int = 0,
    var missingDiameter: Int = 0,
    var hash: String = "",
    var sourceFile: String = "",
    var updatedAt: Long = 0L,
)

/** Một đoạn ống. [parts] gồm các mảng (vĩ độ, kinh độ) xen kẽ. */
class PipeFeature(
    val id: Long,
    val layerId: Long,
    val parts: Array<DoubleArray>,
    val minLat: Double,
    val minLon: Double,
    val maxLat: Double,
    val maxLon: Double,
    val title: String?,
    val diameterMm: Double?,
    val lengthM: Double?,
    val material: String?,
    val dash: Int,
    val props: String,
)

/** Lớp kèm các đoạn ống đã nạp vào bộ nhớ để vẽ. */
class LoadedLayer(val layer: PipeLayer, val features: List<PipeFeature>)

/** Thông tin chi tiết hiện khi chạm vào ống (giống thẻ thông tin trên web). */
data class PipeInfo(val title: String, val planned: Boolean, val rows: List<Pair<String, String>>, val fromServer: Boolean)
