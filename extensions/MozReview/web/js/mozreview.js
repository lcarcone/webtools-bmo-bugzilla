/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * This Source Code Form is "Incompatible With Secondary Licenses", as
 * defined by the Mozilla Public License, v. 2.0.
 */

var MozReview = {};

MozReview.getReviewRequest = function() {
    var hostUrl = $('.mozreview-requests').data('mozreviewUrl');
    var tr = $('<tr/>');
    var td = $('<td/>');

    var rrSummaryApiUrl = hostUrl +
        'api/extensions/mozreview.extension.MozReviewExtension/summary/?bug=' +
        BUGZILLA.bug_id;
    var rrUiBaseUrl = hostUrl + 'r/';

    function rrUrl(rrId) {
        return rrUiBaseUrl + rrId + '/';
    }

    function rrDiffUrl(rrId) {
        return rrUrl(rrId) + 'diff/#index_header';
    }

    function rrRow(rr, isParent) {
        var tdSummary = td.clone();
        var trCommit = tr.clone();
        var reviewLink = $('<a/>');
        var diffLink = reviewLink.clone();

        if (!isParent) {
            tdSummary.addClass('mozreview-child-request-summary');
            diffLink.attr('href', rrDiffUrl(rr.id));
            diffLink.text(rr.commit.substr(0, 12));
            diffLink.addClass('mozreview-diff-link');
            tdSummary.append(diffLink);
            tdSummary.append(' ');
        }

        reviewLink.attr('href', rrUrl(rr.id));
        reviewLink.text(rr.summary);
        tdSummary.append(reviewLink);

        if (isParent) {
            tdSummary.append($('<span/>').text(' (' + rr.submitter + ')'));
        }

        tdSummary.addClass('mozreview-summary');

        trCommit.append(
            tdSummary,
            td.clone().text(rr.status),
            td.clone().text(rr.issue_open_count)
                      .addClass('mozreview-open-issues'),
            td.clone().text(timeAgo(new Date(rr.last_updated)))
        );

        if (rr.status == "discarded") {
            $('.mozreview-hide-discarded-row').removeClass('bz_default_hidden');
            trCommit.addClass('bz_default_hidden mozreview-discarded-request');
        }

        return trCommit;
    }

    $('.mozreview-hide-discarded-link').click(function(event) {
        event.preventDefault();
        if ($('.bz_default_hidden.mozreview-discarded-request').length) {
            $('.mozreview-discarded-request').removeClass('bz_default_hidden');
            $('.mozreview-discarded-action').text('Hide');
        } else {
            $('.mozreview-discarded-request').addClass('bz_default_hidden');
            $('.mozreview-discarded-action').text('Show');
        }
    });

    var tbody = $('tbody.mozreview-request');

    function displayLoadError(errStr) {
        var errRow = tbody.find('.mozreview-loading-error-row');
        errRow.find('.mozreview-load-error-string').text(errStr);
        errRow.removeClass('bz_default_hidden');
    }

    $.getJSON(rrSummaryApiUrl, function(data) {
        var family, parent, i, j;

        if (data.review_request_summaries.length === 0) {
            displayLoadError('none returned from server');
        } else {
            for (i = 0; i < data.review_request_summaries.length; i++) {
                family = data.review_request_summaries[i];
                parent = family.parent;
                tbody.append(rrRow(parent, true));
                for (j = 0; j < family.children.length; j++) {
                    tbody.append(rrRow(family.children[j], false));
                }
            }
        }

        tbody.find('.mozreview-loading-row').addClass('bz_default_hidden');
    }).fail(function(jqXHR, textStatus, errorThrown) {
        var errStr;
        if (jqXHR.responseJSON && jqXHR.responseJSON.err &&
            jqXHR.responseJSON.err.msg) {
            errStr = jqXHR.responseJSON.err.msg;
        } else if (errorThrown) {
            errStr = errorThrown;
        } else {
            errStr = 'unknown';
        }
        displayLoadError(errStr);
        tbody.find('.mozreview-loading-row').addClass('bz_default_hidden');
    });
};

$().ready(function() {
    MozReview.getReviewRequest();
});
