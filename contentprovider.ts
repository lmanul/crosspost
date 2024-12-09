import { readdir, readFile } from 'fs/promises';

type ContentImage = {
    imagePath: string;
    imageDescription: string;
}

type ContentBundle = {
    mainText: string;
    images: ContentImage[];
}

const DESCRIPTIONS_FILENAME = 'descriptions.txt';
const MAIN_TEXT_FILENAME = 'main.txt';

export default class ContentProvider {
    contentDir: string;

    constructor(contentDir: string) {
        this.contentDir = contentDir;
    }

    getContent: () => Promise<ContentBundle> = async () => {
        let mainText = '';

        const fileList = await readdir(this.contentDir);

        const mainTextFile = this.contentDir + '/' + MAIN_TEXT_FILENAME;
        const descFile = this.contentDir + '/' + DESCRIPTIONS_FILENAME;
        if (!fileList.includes(MAIN_TEXT_FILENAME)) {
            throw new Error(
                `Please write the text of your post in ${mainTextFile}`);
        }

        mainText = await readFile(mainTextFile, 'utf-8');

        fileList.sort();
        const imgPaths = fileList.filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
        const images: ContentImage[] = imgPaths.map(p => ({
            imagePath: __dirname + '/' + this.contentDir + '/' + p,
            imageDescription: '',
        }));

        if (fileList.includes(DESCRIPTIONS_FILENAME)) {
            const descriptions = await readFile(descFile, 'utf-8').then(raw => {
                return raw.split('\n\n').map(s => s.trim()).filter(s => s != '');
            });

            if (descriptions.length !== imgPaths.length) {
                throw new Error(`You have provided ${imgPaths.length} images but ${descriptions.length} descriptions.`);
            }

            for (let i = 0; i < descriptions.length; i++) {
                images[i].imageDescription = descriptions[i];
            }

        }

        return {
            mainText, images
        };
    };
};
