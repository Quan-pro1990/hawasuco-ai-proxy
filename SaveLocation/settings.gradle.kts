pluginManagement {
    repositories {
        google()
        // Bản sao Maven Central của Google (dùng khi repo.maven.apache.org giới hạn tốc độ tải)
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        // Bản sao Maven Central của Google (dùng khi repo.maven.apache.org giới hạn tốc độ tải)
        maven("https://maven-central.storage-download.googleapis.com/maven2/")
        mavenCentral()
    }
}
rootProject.name = "SaveLocation"
include(":app")
