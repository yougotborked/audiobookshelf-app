package com.audiobookshelf.app.data

import com.fasterxml.jackson.annotation.JsonIgnoreProperties

@JsonIgnoreProperties(ignoreUnknown = true)
data class PlayQueueItem(
    var libraryItemId: String = "",
    var episodeId: String? = null
)
