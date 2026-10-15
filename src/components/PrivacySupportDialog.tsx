import {useI18n} from '../i18n/context';
import {getLegalContent} from '../legal/content';
import {StudioDialog} from './StudioDialogs';
import './PrivacySupportDialog.css';

export type PrivacySupportKind = 'privacy' | 'support';

/** Available offline: opening this dialog never requests microphone access or a network page. */
export function PrivacySupportDialog({kind, onClose}: {
  kind: PrivacySupportKind;
  onClose: () => void;
}) {
  const {locale} = useI18n();
  const content = getLegalContent(locale);
  const document = content[kind];

  return <StudioDialog title={document.title} onClose={onClose}>
    <article className="privacy-support-content" lang={content.language}>
      {content.fallbackNotice && <p className="privacy-support-language">{content.fallbackNotice}</p>}
      <p className="privacy-support-introduction">{document.introduction}</p>
      {content.draftNotice && <p className="privacy-support-notice">{content.draftNotice}</p>}

      {document.sections.map((section, index) => <section className="privacy-support-section" key={`${index}-${section.heading}`}>
        <h3>{section.heading}</h3>
        {section.paragraphs.map((paragraph, paragraphIndex) => <p key={paragraphIndex}>{paragraph}</p>)}
      </section>)}

      <dl className="privacy-support-details">
        <div><dt>{content.updatedLabel}</dt><dd><time dateTime={content.updated}>{content.updated}</time></dd></div>
        {content.publisherName && <div><dt>{content.publisherLabel}</dt><dd>{content.publisherName}</dd></div>}
        {content.supportEmail && <div><dt>{content.contactLabel}</dt><dd><a href={`mailto:${content.supportEmail}`}>{content.supportEmail}</a></dd></div>}
      </dl>

      <div className="privacy-support-actions">
        <button type="button" className="primary-button" onClick={onClose}>{content.closeLabel}</button>
      </div>
    </article>
  </StudioDialog>;
}
